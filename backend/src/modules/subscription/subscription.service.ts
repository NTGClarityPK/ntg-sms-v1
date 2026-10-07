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
  getPlanConfig,
  listPlanConfigs,
  parsePlanId,
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
} from './dto/subscription.dto';
import {
  DowngradeNotAllowedException,
  SubscriptionFeatureForbiddenException,
  SubscriptionLimitForbiddenException,
} from './subscription.errors';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionStripeService } from './subscription-stripe.service';
import { isStripeConfigured } from './stripe-config';
import { calculateSubscriptionInvoiceAmount } from './plan-pricing';
import {
  clearEnterpriseSnapshotPatch,
  ENTERPRISE_SELECT_COLUMNS,
  enterpriseOfferDiffersFromActiveTerms,
  resolvePlanFeatures,
  resolvePlanLimits,
  snapshotFromOffer,
  toNum,
  type EnterpriseSubscriptionFields,
} from './enterprise-terms';

type SubscriptionRow = EnterpriseSubscriptionFields & {
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
    const row = await this.fetchSubscriptionRow(tenantId);
    return this.mapSubscription(row);
  }

  async fetchSubscriptionRow(tenantId: string): Promise<SubscriptionRow> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select(ENTERPRISE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) {
      await this.ensureSubscriptionForTenant(tenantId);
      return this.fetchSubscriptionRow(tenantId);
    }
    return data as unknown as SubscriptionRow;
  }

  async getResolvedFeatures(tenantId: string): Promise<{
    planId: PlanId;
    features: PlanFeatures;
  }> {
    const row = await this.fetchSubscriptionRow(tenantId);
    const planId = parsePlanId(row.plan_id) ?? PlanId.FREE;
    return { planId, features: resolvePlanFeatures(planId, row) };
  }

  async getPortalSubscriptionDetail(tenantId: string): Promise<Record<string, unknown>> {
    const row = await this.fetchSubscriptionRow(tenantId);
    const planId = parsePlanId(row.plan_id) ?? PlanId.FREE;
    const features = resolvePlanFeatures(planId, row);
    const limits = resolvePlanLimits(planId, row);
    const offerEnabled = Boolean(row.enterprise_enabled);
    const offerChanged = enterpriseOfferDiffersFromActiveTerms(row);

    return {
      ...this.mapSubscription(row),
      planFeatures: features,
      planLimits: limits,
      setupFeePaidUsd: toNum(row.setup_fee_paid_usd) ?? 0,
      firstSubscriptionStartDate: row.first_subscription_start_date,
      accessStartsAt: row.access_starts_at,
      enterprisePricing: {
        enabled: offerEnabled,
        price: toNum(row.enterprise_price),
        durationMonths: row.enterprise_duration_months,
        currentPrice: toNum(row.current_enterprise_price),
        currentDurationMonths: row.current_enterprise_duration_months,
        setupFee: toNum(row.enterprise_setup_fee) ?? 0,
        paidTrialEnabled: Boolean(row.enterprise_paid_trial_enabled),
        paidTrialDurationDays: row.enterprise_paid_trial_duration_days,
        preTrialSetupFee: toNum(row.enterprise_pre_trial_setup_fee) ?? 0,
        postTrialSetupFee: toNum(row.enterprise_post_trial_setup_fee) ?? 0,
        inPaidTrial: Boolean(row.enterprise_in_paid_trial),
        offerChanged,
        accessStartsAt: row.enterprise_access_starts_at,
      },
      enterpriseOfferLimits: {
        branches: row.enterprise_branches_limit,
        students: row.enterprise_students_limit,
        storageGb: toNum(row.enterprise_storage_gb_limit),
      },
      enterpriseLimits: {
        branches: row.current_enterprise_branches_limit,
        students: row.current_enterprise_students_limit,
        storageGb: toNum(row.current_enterprise_storage_gb_limit),
      },
      enterpriseFeatures: {
        fees: Boolean(row.enterprise_fees_enabled),
        library: Boolean(row.enterprise_library_enabled),
        behavioural: Boolean(row.enterprise_behavioural_enabled),
        uniformInventory: Boolean(row.enterprise_uniform_inventory_enabled),
        whiteLabel: Boolean(row.enterprise_white_label_enabled),
        googleClassroom: Boolean(row.enterprise_google_classroom_enabled),
      },
    };
  }

  /**
   * Accept Ops enterprise offer (trial / subscribe / apply new terms).
   */
  async acceptEnterpriseOffer(
    tenantId: string,
    mode: 'start_trial' | 'subscribe' | 'apply_terms',
  ): Promise<ChangePlanResultDto> {
    const row = await this.fetchSubscriptionRow(tenantId);
    if (!row.enterprise_enabled || !toNum(row.enterprise_price)) {
      throw new BadRequestException('No enterprise offer is available');
    }

    const setupList =
      mode === 'start_trial'
        ? (toNum(row.enterprise_pre_trial_setup_fee) ?? 0)
        : mode === 'subscribe' && row.enterprise_paid_trial_enabled
          ? (toNum(row.enterprise_post_trial_setup_fee) ?? 0)
          : (toNum(row.enterprise_setup_fee) ?? 0);
    const paid = toNum(row.setup_fee_paid_usd) ?? 0;
    const due = Math.max(0, setupList - paid);

    const currentPrice = toNum(row.current_enterprise_price);
    const offerPrice = toNum(row.enterprise_price) ?? 0;
    if (
      mode === 'apply_terms' &&
      currentPrice !== null &&
      offerPrice < currentPrice
    ) {
      const supabase = this.supabaseConfig.getClient();
      await supabase
        .from('subscriptions')
        .update({
          pending_plan_id: PlanId.ENTERPRISE,
          pending_billing_cycle: BillingCycle.MONTHLY,
        })
        .eq('tenant_id', tenantId);
      return {
        type: 'downgrade-scheduled',
        message: 'Enterprise term downgrade scheduled for end of billing period',
        effectiveDate: row.current_period_end,
        subscription: await this.getByTenantId(tenantId),
      };
    }

    if (due > 0 && isStripeConfigured()) {
      return {
        type: 'checkout_required',
        message: 'Payment required to accept enterprise offer',
        checkoutUrl: undefined,
      };
    }

    return this.applyEnterpriseAcceptance(tenantId, mode, setupList);
  }

  async applyEnterpriseAcceptance(
    tenantId: string,
    mode: 'start_trial' | 'subscribe' | 'apply_terms',
    setupListPrice = 0,
  ): Promise<ChangePlanResultDto> {
    const row = await this.fetchSubscriptionRow(tenantId);
    const now = new Date();
    const durationMonths = row.enterprise_duration_months ?? 12;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

    const paidSoFar = toNum(row.setup_fee_paid_usd) ?? 0;
    const newWatermark = Math.max(paidSoFar, setupListPrice);

    const trialDays = row.enterprise_paid_trial_duration_days ?? 14;
    const trialEnds =
      mode === 'start_trial'
        ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const patch: Record<string, unknown> = {
      ...snapshotFromOffer(row),
      plan_id: PlanId.ENTERPRISE,
      billing_cycle: BillingCycle.MONTHLY,
      status: mode === 'start_trial' ? 'trial' : 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_ends_at: trialEnds,
      enterprise_in_paid_trial: mode === 'start_trial',
      pending_plan_id: null,
      pending_billing_cycle: null,
      setup_fee_paid_usd: newWatermark,
    };

    if (!row.first_subscription_start_date) {
      patch.first_subscription_start_date = now.toISOString().slice(0, 10);
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .update(patch)
      .eq('tenant_id', tenantId)
      .select(ENTERPRISE_SELECT_COLUMNS)
      .single();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to accept enterprise offer');

    return {
      type: 'upgrade',
      message:
        mode === 'start_trial'
          ? 'Enterprise trial started'
          : mode === 'apply_terms'
            ? 'Enterprise terms applied'
            : 'Enterprise subscription activated',
      subscription: this.mapSubscription(data as unknown as SubscriptionRow),
    };
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
    const current = await this.fetchSubscriptionRow(tenantId);

    const leavingEnterprise =
      current.plan_id === PlanId.ENTERPRISE && targetPlan !== PlanId.ENTERPRISE;

    const enteringEnterpriseFromPending =
      targetPlan === PlanId.ENTERPRISE &&
      current.enterprise_enabled &&
      toNum(current.enterprise_price) !== null;

    const updatePatch: Record<string, unknown> = {
      plan_id: targetPlan,
      billing_cycle: targetCycle,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      pending_plan_id: null,
      pending_billing_cycle: null,
      status: 'active',
    };

    if (leavingEnterprise) {
      Object.assign(updatePatch, clearEnterpriseSnapshotPatch());
    } else if (enteringEnterpriseFromPending) {
      Object.assign(updatePatch, snapshotFromOffer(current));
      if (!current.first_subscription_start_date) {
        updatePatch.first_subscription_start_date = now
          .toISOString()
          .slice(0, 10);
      }
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updatePatch)
      .eq('tenant_id', tenantId)
      .select(ENTERPRISE_SELECT_COLUMNS)
      .single();

    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to upgrade plan');

    const row = data as unknown as SubscriptionRow;
    if (!options?.skipInvoiceCreation && targetPlan !== PlanId.ENTERPRISE) {
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
      storageMB: usagePayload.usage.storageUsedMb,
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
      .select(ENTERPRISE_SELECT_COLUMNS)
      .single();

    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to schedule downgrade');

    return {
      type: 'downgrade-scheduled',
      message: `Downgrade to ${targetPlan} scheduled for end of billing period`,
      effectiveDate: subscription.currentPeriodEnd,
      subscription: this.mapSubscription(data as unknown as SubscriptionRow),
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
    const row = await this.fetchSubscriptionRow(tenantId);
    const planId = parsePlanId(row.plan_id) ?? PlanId.FREE;
    const limits = resolvePlanLimits(planId, row);

    const supabase = this.supabaseConfig.getClient();
    const { data: usageRow, error } = await supabase
      .from('subscription_usage')
      .select(
        'branches_used, students_used, staff_used, classes_used, storage_used_mb, reports_this_month, sms_this_month, last_reset_at',
      )
      .eq('subscription_id', row.id)
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
    _userRoles?: string[],
  ): Promise<void> {
    // Only enforce branches / students / storage per product decision
    if (metric !== 'branches' && metric !== 'students' && metric !== 'storageMB') {
      return;
    }

    const row = await this.fetchSubscriptionRow(tenantId);
    const planId = parsePlanId(row.plan_id) ?? PlanId.FREE;
    const limits = resolvePlanLimits(planId, row);
    const limit = limits[metric];
    if (limit === -1 || proposedValue <= limit) return;

    const usage = await this.getUsageWithLimits(tenantId, true);
    const usedMap: Record<'branches' | 'students' | 'storageMB', number> = {
      branches: usage.usage.branchesUsed,
      students: usage.usage.studentsUsed,
      storageMB: usage.usage.storageUsedMb,
    };
    throw new SubscriptionLimitForbiddenException(metric, limit, usedMap[metric]);
  }

  async assertFeature(
    tenantId: string,
    feature: keyof PlanFeatures,
    _userRoles?: string[],
  ): Promise<void> {
    const { features } = await this.getResolvedFeatures(tenantId);
    if (!features[feature]) {
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
