import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronJobEnabled } from '../../common/config/cron-job-enabled.util';
import { CRON_JOB_ENV_KEYS } from '../../common/config/cron-job-env-keys';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  BillingCycle,
  canDowngrade,
  exceedsLimit,
  getPlanConfig,
  listPlanConfigs,
  parsePlanId,
  planHasFeature,
  PlanId,
  type PlanFeatures,
  type PlanLimits,
} from './plan-config';
import { classifyTransition } from './plan-transition';
import { ChangePlanDto } from './dto/change-plan.dto';
import {
  ChangePlanResultDto,
  PlanConfigDto,
  SubscriptionDto,
  SubscriptionUsageDto,
  SubscriptionUsageWithLimitsDto,
  TenantSubscriptionSummaryDto,
} from './dto/subscription.dto';
import {
  DowngradeNotAllowedException,
  SubscriptionFeatureForbiddenException,
  SubscriptionLimitForbiddenException,
} from './subscription.errors';
import type { AdminUpdateSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionStripeService } from './subscription-stripe.service';
import { isStripeConfigured } from './stripe-config';
import { calculateSubscriptionInvoiceAmount } from './plan-pricing';

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  pending_plan_id: string | null;
  pending_billing_cycle: string | null;
  cancelled_at: string | null;
  notes: string | null;
};

type UsageRow = {
  id: string;
  subscription_id: string;
  branches_used: number;
  students_used: number;
  staff_used: number;
  classes_used: number;
  storage_used_mb: number;
  reports_this_month: number;
  sms_this_month: number;
  last_reset_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class SubscriptionService {
  private readonly endOfPeriodJobEnabled: boolean;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly subscriptionInvoiceService: SubscriptionInvoiceService,
    @Inject(forwardRef(() => SubscriptionStripeService))
    private readonly subscriptionStripeService: SubscriptionStripeService,
    private readonly configService: ConfigService,
  ) {
    this.endOfPeriodJobEnabled = isCronJobEnabled(
      this.configService,
      CRON_JOB_ENV_KEYS.subscriptionEndOfPeriod,
      'production',
    );
  }

  async getByTenantId(tenantId: string): Promise<SubscriptionDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        'id, tenant_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_ends_at, pending_plan_id, pending_billing_cycle, cancelled_at, notes',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) {
      await this.ensureSubscriptionForTenant(tenantId);
      return this.getByTenantId(tenantId);
    }
    return this.mapSubscription(data as SubscriptionRow);
  }

  async ensureSubscriptionForTenant(tenantId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (existing) return;

    const { data: inserted, error } = await supabase
      .from('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_id: PlanId.FREE,
        billing_cycle: BillingCycle.MONTHLY,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    throwIfDbError(error);
    if (inserted) {
      await supabase.from('subscription_usage').insert({ subscription_id: inserted.id });
    }
  }

  async changePlan(tenantId: string, dto: ChangePlanDto): Promise<{ data: ChangePlanResultDto }> {
    const subscription = await this.getByTenantId(tenantId);
    const targetPlan = dto.planId;
    const targetCycle =
      dto.billingCycle ?? (subscription.billingCycle as BillingCycle);

    const currentPlan = parsePlanId(subscription.planId);
    const currentCycle = subscription.billingCycle as BillingCycle;
    if (!currentPlan) {
      throw new BadRequestException('Invalid current plan');
    }

    if (
      subscription.pendingPlanId &&
      targetPlan === currentPlan &&
      targetCycle === currentCycle
    ) {
      await this.clearPendingChange(tenantId);
      return {
        data: {
          type: 'pending-cleared',
          message: 'Pending change cancelled',
          subscription: await this.getByTenantId(tenantId),
        },
      };
    }

    const transitionType = classifyTransition(
      currentPlan,
      currentCycle,
      targetPlan,
      targetCycle,
    );

    switch (transitionType) {
      case 'noop':
        return {
          data: {
            type: 'noop',
            message: 'Already on this plan',
            subscription,
          },
        };
      case 'contact-sales':
        return {
          data: {
            type: 'contact-sales',
            message: 'Please contact sales for the Enterprise plan',
          },
        };
      case 'upgrade': {
        const usagePayload = await this.getUsageWithLimits(tenantId, true);
        const breakdown = calculateSubscriptionInvoiceAmount(
          targetPlan,
          targetCycle,
          usagePayload.usage.studentsUsed,
        );
        if (
          isStripeConfigured() &&
          breakdown &&
          breakdown.amountCents > 0
        ) {
          return {
            data: await this.subscriptionStripeService.createUpgradeCheckout(
              tenantId,
              targetPlan,
              targetCycle,
              usagePayload.usage.studentsUsed,
            ),
          };
        }
        return {
          data: await this.applyUpgrade(tenantId, targetPlan, targetCycle),
        };
      }
      case 'downgrade-scheduled':
        return {
          data: await this.scheduleDowngrade(tenantId, targetPlan, targetCycle),
        };
      default:
        throw new BadRequestException('Invalid transition');
    }
  }

  /**
   * After Stripe payment for a pending-upgrade invoice — applies the plan change.
   */
  async fulfillPaidUpgradeInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data: invoice, error } = await supabase
      .from('subscription_invoices')
      .select(
        'id, tenant_id, pending_upgrade_plan_id, pending_upgrade_billing_cycle, status',
      )
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!invoice) return;

    const row = invoice as {
      pending_upgrade_plan_id: string | null;
      pending_upgrade_billing_cycle: string | null;
    };

    const targetPlan = parsePlanId(row.pending_upgrade_plan_id ?? '');
    const targetCycle = row.pending_upgrade_billing_cycle as BillingCycle | null;
    if (!targetPlan || !targetCycle) return;

    const current = await this.getByTenantId(tenantId);
    if (
      current.planId === targetPlan &&
      current.billingCycle === targetCycle
    ) {
      return;
    }

    await this.applyUpgrade(tenantId, targetPlan, targetCycle, {
      skipInvoiceCreation: true,
    });

    await supabase
      .from('subscription_invoices')
      .update({
        pending_upgrade_plan_id: null,
        pending_upgrade_billing_cycle: null,
      })
      .eq('id', invoiceId);
  }

  private async applyUpgrade(
    tenantId: string,
    targetPlan: PlanId,
    targetCycle: BillingCycle,
    options?: { skipInvoiceCreation?: boolean },
  ): Promise<ChangePlanResultDto> {
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, targetCycle);
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan_id: targetPlan,
        billing_cycle: targetCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        pending_plan_id: null,
        pending_billing_cycle: null,
        status: 'active',
      })
      .eq('tenant_id', tenantId)
      .select(
        'id, tenant_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_ends_at, pending_plan_id, pending_billing_cycle, cancelled_at, notes',
      )
      .single();

    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to upgrade plan');

    const row = data as SubscriptionRow;
    if (!options?.skipInvoiceCreation) {
      const usage = await this.getUsageWithLimits(tenantId, true);
      await this.subscriptionInvoiceService.ensurePeriodInvoice({
        tenantId,
        subscriptionId: row.id,
        planId: targetPlan,
        billingCycle: targetCycle,
        periodStart: now,
        periodEnd,
        studentsUsed: usage.usage.studentsUsed,
        reason: 'upgrade',
      });
    }

    return {
      type: 'upgrade',
      message: 'Plan upgraded successfully',
      subscription: this.mapSubscription(row),
    };
  }

  private async scheduleDowngrade(
    tenantId: string,
    targetPlan: PlanId,
    targetCycle: BillingCycle,
  ): Promise<ChangePlanResultDto> {
    const usagePayload = await this.getUsageWithLimits(tenantId, true);
    const { allowed, reasons } = canDowngrade(targetPlan, {
      branches: usagePayload.usage.branchesUsed,
      students: usagePayload.usage.studentsUsed,
      staff: usagePayload.usage.staffUsed,
      classes: usagePayload.usage.classesUsed,
      storageMB: usagePayload.usage.storageUsedMb,
      monthlyReports: usagePayload.usage.reportsThisMonth,
      monthlySMS: usagePayload.usage.smsThisMonth,
    });
    if (!allowed) {
      throw new DowngradeNotAllowedException(reasons);
    }

    const subscription = await this.getByTenantId(tenantId);
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        pending_plan_id: targetPlan,
        pending_billing_cycle: targetCycle,
      })
      .eq('tenant_id', tenantId)
      .select(
        'id, tenant_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_ends_at, pending_plan_id, pending_billing_cycle, cancelled_at, notes',
      )
      .single();

    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to schedule downgrade');

    return {
      type: 'downgrade-scheduled',
      message: `Downgrade to ${targetPlan} scheduled for end of billing period`,
      effectiveDate: subscription.currentPeriodEnd,
      subscription: this.mapSubscription(data as SubscriptionRow),
    };
  }

  async clearPendingChange(tenantId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase
      .from('subscriptions')
      .update({
        pending_plan_id: null,
        pending_billing_cycle: null,
      })
      .eq('tenant_id', tenantId);
    throwIfDbError(error);
  }

  async getUsageWithLimits(
    tenantId: string,
    refresh = false,
  ): Promise<SubscriptionUsageWithLimitsDto> {
    if (refresh) {
      await this.syncUsage(tenantId);
    }
    const subscription = await this.getByTenantId(tenantId);
    const planId = parsePlanId(subscription.planId) ?? PlanId.FREE;
    const limits = getPlanConfig(planId).limits;

    const supabase = this.supabaseConfig.getClient();
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    const { data: usageRow, error } = await supabase
      .from('subscription_usage')
      .select(
        'branches_used, students_used, staff_used, classes_used, storage_used_mb, reports_this_month, sms_this_month, last_reset_at',
      )
      .eq('subscription_id', subRow?.id ?? '')
      .maybeSingle();

    throwIfDbError(error);

    const usage = this.mapUsage((usageRow ?? {}) as UsageRow);

    return {
      usage,
      limits: { ...limits },
      planId,
    };
  }

  async syncUsage(tenantId: string): Promise<SubscriptionUsageDto> {
    const supabase = this.supabaseConfig.getClient();
    const subscription = await this.getByTenantId(tenantId);

    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, storage_used_bytes, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    throwIfDbError(branchesError);

    const branchIds = (branches ?? []).map((b: { id: string }) => b.id);
    const branchesUsed = branchIds.length;

    let studentsUsed = 0;
    let staffUsed = 0;
    let classesUsed = 0;
    let storageUsedMb = 0;

    if (branchIds.length > 0) {
      const { count: studentCount, error: studentError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .in('branch_id', branchIds)
        .eq('is_active', true);
      throwIfDbError(studentError);
      studentsUsed = studentCount ?? 0;

      const { data: studentRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'student')
        .maybeSingle();

      const studentRoleId = (studentRole as { id: string } | null)?.id;

      const { data: userRoles, error: urError } = await supabase
        .from('user_roles')
        .select('user_id, role_id')
        .in('branch_id', branchIds);
      throwIfDbError(urError);

      const staffUserIds = new Set<string>();
      for (const ur of userRoles ?? []) {
        const row = ur as { user_id: string; role_id: string };
        if (studentRoleId && row.role_id === studentRoleId) continue;
        staffUserIds.add(row.user_id);
      }
      staffUsed = staffUserIds.size;

      const { count: classCount, error: classError } = await supabase
        .from('class_sections')
        .select('id', { count: 'exact', head: true })
        .in('branch_id', branchIds);
      throwIfDbError(classError);
      classesUsed = classCount ?? 0;
    }

    for (const b of branches ?? []) {
      const bytes = (b as { storage_used_bytes?: number }).storage_used_bytes ?? 0;
      storageUsedMb += Math.ceil(bytes / (1024 * 1024));
    }

    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    const { data: existingUsage } = await supabase
      .from('subscription_usage')
      .select('reports_this_month, sms_this_month')
      .eq('subscription_id', subRow?.id ?? '')
      .maybeSingle();

    const reportsThisMonth =
      (existingUsage as { reports_this_month?: number } | null)?.reports_this_month ?? 0;
    const smsThisMonth =
      (existingUsage as { sms_this_month?: number } | null)?.sms_this_month ?? 0;

    const { error: updateError } = await supabase
      .from('subscription_usage')
      .update({
        branches_used: branchesUsed,
        students_used: studentsUsed,
        staff_used: staffUsed,
        classes_used: classesUsed,
        storage_used_mb: storageUsedMb,
        reports_this_month: reportsThisMonth,
        sms_this_month: smsThisMonth,
        recorded_at: new Date().toISOString(),
      })
      .eq('subscription_id', subscription.id);

    throwIfDbError(updateError);

    return {
      branchesUsed,
      studentsUsed,
      staffUsed,
      classesUsed,
      storageUsedMb,
      reportsThisMonth,
      smsThisMonth,
      lastResetAt: new Date().toISOString(),
    };
  }

  async assertWithinLimit(
    tenantId: string,
    metric: keyof PlanLimits,
    proposedValue: number,
    userRoles?: string[],
  ): Promise<void> {
    if (userRoles?.some((r) => r.toLowerCase() === 'super_admin')) return;

    const subscription = await this.getByTenantId(tenantId);
    const planId = parsePlanId(subscription.planId) ?? PlanId.FREE;
    if (!exceedsLimit(planId, metric, proposedValue)) return;

    const limit = getPlanConfig(planId).limits[metric];
    const usage = await this.getUsageWithLimits(tenantId, true);
    const usedMap: Record<keyof PlanLimits, number> = {
      branches: usage.usage.branchesUsed,
      students: usage.usage.studentsUsed,
      staff: usage.usage.staffUsed,
      classes: usage.usage.classesUsed,
      storageMB: usage.usage.storageUsedMb,
      monthlyReports: usage.usage.reportsThisMonth,
      monthlySMS: usage.usage.smsThisMonth,
    };
    throw new SubscriptionLimitForbiddenException(metric, limit, usedMap[metric]);
  }

  async assertFeature(
    tenantId: string,
    feature: keyof PlanFeatures,
    userRoles?: string[],
  ): Promise<void> {
    if (userRoles?.some((r) => r.toLowerCase() === 'super_admin')) return;

    const subscription = await this.getByTenantId(tenantId);
    const planId = parsePlanId(subscription.planId) ?? PlanId.FREE;
    if (!planHasFeature(planId, feature)) {
      throw new SubscriptionFeatureForbiddenException(feature);
    }
  }

  getPlans(): { data: PlanConfigDto[] } {
    return {
      data: listPlanConfigs().map((p) => ({
        id: p.id,
        name: p.name,
        order: p.order,
        limits: { ...p.limits },
        features: { ...p.features },
      })),
    };
  }

  async processEndOfPeriod(tenantId: string): Promise<void> {
    const subscription = await this.getByTenantId(tenantId);
    const periodEnd = new Date(subscription.currentPeriodEnd);
    if (new Date() < periodEnd) return;

    if (subscription.pendingPlanId) {
      const pendingPlan = parsePlanId(subscription.pendingPlanId);
      const pendingCycle =
        (subscription.pendingBillingCycle as BillingCycle) ??
        (subscription.billingCycle as BillingCycle);
      if (pendingPlan) {
        await this.applyUpgrade(tenantId, pendingPlan, pendingCycle);
        return;
      }
    }

    const cycle = subscription.billingCycle as BillingCycle;
    const newStart = periodEnd;
    const newEnd = this.calculatePeriodEnd(newStart, cycle);
    const supabase = this.supabaseConfig.getClient();

    const { data: subRow } = await supabase
      .from('subscriptions')
      .update({
        current_period_start: newStart.toISOString(),
        current_period_end: newEnd.toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select('id, plan_id, billing_cycle')
      .single();

    await this.resetMonthlyCounters(tenantId);

    if (subRow) {
      const planId = parsePlanId((subRow as { plan_id: string }).plan_id) ?? PlanId.FREE;
      const billingCycle =
        (subRow as { billing_cycle: string }).billing_cycle === 'yearly'
          ? BillingCycle.YEARLY
          : BillingCycle.MONTHLY;
      const usage = await this.getUsageWithLimits(tenantId, false);
      await this.subscriptionInvoiceService.ensurePeriodInvoice({
        tenantId,
        subscriptionId: (subRow as { id: string }).id,
        planId,
        billingCycle,
        periodStart: newStart,
        periodEnd: newEnd,
        studentsUsed: usage.usage.studentsUsed,
        reason: 'renewal',
      });
    }
  }

  private async resetMonthlyCounters(tenantId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();
    if (!subRow) return;

    await supabase
      .from('subscription_usage')
      .update({
        reports_this_month: 0,
        sms_this_month: 0,
        last_reset_at: new Date().toISOString(),
      })
      .eq('subscription_id', subRow.id);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processAllEndOfPeriod(): Promise<void> {
    if (!this.endOfPeriodJobEnabled) return;
    const supabase = this.supabaseConfig.getClient();
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('subscriptions')
      .select('tenant_id')
      .lte('current_period_end', nowIso);
    throwIfDbError(error);

    for (const row of due ?? []) {
      await this.processEndOfPeriod((row as { tenant_id: string }).tenant_id);
    }
  }

  async listAllForAdmin(): Promise<{ data: TenantSubscriptionSummaryDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, code')
      .order('name');
    throwIfDbError(tenantsError);

    const summaries: TenantSubscriptionSummaryDto[] = [];
    for (const t of tenants ?? []) {
      const tenant = t as { id: string; name: string; code: string };
      await this.syncUsage(tenant.id);
      const subscription = await this.getByTenantId(tenant.id);
      const usagePayload = await this.getUsageWithLimits(tenant.id);
      summaries.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantCode: tenant.code,
        subscription,
        usage: usagePayload.usage,
      });
    }
    return { data: summaries };
  }

  async adminUpdateSubscription(
    tenantId: string,
    dto: AdminUpdateSubscriptionDto,
  ): Promise<{ data: SubscriptionDto }> {
    const supabase = this.supabaseConfig.getClient();
    const updates: Record<string, unknown> = {};

    if (dto.planId) updates.plan_id = dto.planId;
    if (dto.billingCycle) updates.billing_cycle = dto.billingCycle;
    if (dto.status) updates.status = dto.status;
    if (dto.notes !== undefined) updates.notes = dto.notes;
    if (dto.clearPending) {
      updates.pending_plan_id = null;
      updates.pending_billing_cycle = null;
    }

    if (dto.planId) {
      const now = new Date();
      const cycle = dto.billingCycle ?? BillingCycle.MONTHLY;
      updates.current_period_start = now.toISOString();
      updates.current_period_end = this.calculatePeriodEnd(now, cycle).toISOString();
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('tenant_id', tenantId)
      .select(
        'id, tenant_id, plan_id, billing_cycle, status, current_period_start, current_period_end, trial_ends_at, pending_plan_id, pending_billing_cycle, cancelled_at, notes',
      )
      .single();

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Subscription not found');

    const mapped = this.mapSubscription(data as SubscriptionRow);
    if (dto.planId) {
      const usage = await this.getUsageWithLimits(tenantId, true);
      await this.subscriptionInvoiceService.ensurePeriodInvoice({
        tenantId,
        subscriptionId: mapped.id,
        planId: dto.planId,
        billingCycle: (dto.billingCycle ?? mapped.billingCycle) as BillingCycle,
        periodStart: new Date(mapped.currentPeriodStart),
        periodEnd: new Date(mapped.currentPeriodEnd),
        studentsUsed: usage.usage.studentsUsed,
        reason: 'admin',
      });
    }

    return { data: mapped };
  }

  private calculatePeriodEnd(start: Date, cycle: BillingCycle): Date {
    const end = new Date(start);
    if (cycle === BillingCycle.MONTHLY) {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }

  private mapSubscription(row: SubscriptionRow): SubscriptionDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      planId: row.plan_id as PlanId,
      billingCycle: row.billing_cycle as BillingCycle,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      trialEndsAt: row.trial_ends_at ?? undefined,
      pendingPlanId: row.pending_plan_id
        ? (row.pending_plan_id as PlanId)
        : undefined,
      pendingBillingCycle: row.pending_billing_cycle
        ? (row.pending_billing_cycle as BillingCycle)
        : undefined,
      cancelledAt: row.cancelled_at ?? undefined,
      notes: row.notes ?? undefined,
    };
  }

  private mapUsage(row: Partial<UsageRow>): SubscriptionUsageDto {
    return {
      branchesUsed: row.branches_used ?? 0,
      studentsUsed: row.students_used ?? 0,
      staffUsed: row.staff_used ?? 0,
      classesUsed: row.classes_used ?? 0,
      storageUsedMb: row.storage_used_mb ?? 0,
      reportsThisMonth: row.reports_this_month ?? 0,
      smsThisMonth: row.sms_this_month ?? 0,
      lastResetAt: row.last_reset_at ?? new Date().toISOString(),
    };
  }
}
