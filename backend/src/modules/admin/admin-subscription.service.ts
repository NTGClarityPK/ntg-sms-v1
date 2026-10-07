import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  BillingCycle,
  parsePlanId,
  PlanId,
  storageMbToGb,
} from '../subscription/plan-config';
import {
  clearEnterpriseOfferPatch,
  ENTERPRISE_SELECT_COLUMNS,
  enterpriseOfferDiffersFromActiveTerms,
  hasActiveEnterpriseSnapshot,
  resolvePlanLimits,
  toNum,
  type EnterpriseSubscriptionFields,
} from '../subscription/enterprise-terms';
import { SubscriptionService } from '../subscription/subscription.service';
import { PutEnterpriseOfferDto } from './dto/enterprise-offer.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function toAdminBillingCycle(cycle: string | null | undefined): string | null {
  if (cycle === 'yearly') return '1_year';
  if (cycle === 'monthly') return '1_month';
  return cycle ?? null;
}

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

@Injectable()
export class AdminSubscriptionService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async listTenants(q?: string): Promise<{ data: Record<string, unknown>[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(
        'id, name, code, domain, email, assessments_creation_locked',
      )
      .order('name', { ascending: true })
      .limit(500);

    throwIfDbError(error);

    const needle = q?.trim().toLowerCase();
    const rows = (tenants ?? [])
      .filter((t) => {
        if (!needle) return true;
        const row = t as {
          name: string;
          code: string | null;
          email: string | null;
        };
        return (
          row.name.toLowerCase().includes(needle) ||
          (row.code ?? '').toLowerCase().includes(needle) ||
          (row.email ?? '').toLowerCase().includes(needle)
        );
      })
      .slice(0, 200) as Array<{
      id: string;
      name: string;
      code: string;
      domain: string | null;
      email: string | null;
      assessments_creation_locked: boolean | null;
    }>;

    if (rows.length === 0) {
      return { data: [] };
    }

    const tenantIds = rows.map((t) => t.id);

    // Batch: subscriptions + usage (avoid N+1 — was timing out Reach Ops)
    const { data: subsData, error: subsError } = await supabase
      .from('subscriptions')
      .select(ENTERPRISE_SELECT_COLUMNS)
      .in('tenant_id', tenantIds);
    throwIfDbError(subsError);

    const subs = (subsData ?? []) as unknown as Array<
      EnterpriseSubscriptionFields & {
        id: string;
        tenant_id: string;
        plan_id: string;
        billing_cycle: string;
        status: string;
        current_period_start: string;
        current_period_end: string;
      }
    >;
    const subByTenant = new Map(subs.map((s) => [s.tenant_id, s]));
    const subscriptionIds = subs.map((s) => s.id);

    const usageBySubId = new Map<
      string,
      {
        branches_used: number;
        students_used: number;
        storage_used_mb: number;
      }
    >();
    if (subscriptionIds.length > 0) {
      const { data: usageData, error: usageError } = await supabase
        .from('subscription_usage')
        .select(
          'subscription_id, branches_used, students_used, storage_used_mb',
        )
        .in('subscription_id', subscriptionIds);
      throwIfDbError(usageError);
      for (const u of usageData ?? []) {
        const row = u as {
          subscription_id: string;
          branches_used: number;
          students_used: number;
          storage_used_mb: number;
        };
        usageBySubId.set(row.subscription_id, row);
      }
    }

    const result: Record<string, unknown>[] = rows.map((tenant) => {
      const subRow = subByTenant.get(tenant.id) ?? null;
      const planId = parsePlanId(subRow?.plan_id ?? '') ?? PlanId.FREE;
      const limits = resolvePlanLimits(planId, subRow);
      const usage = subRow ? usageBySubId.get(subRow.id) : undefined;

      return {
        id: tenant.id,
        name: tenant.name,
        ownerName: null,
        ownerEmail: tenant.email,
        planId: subRow?.plan_id ?? planId,
        planStatus: subRow?.status ?? null,
        enterpriseInPaidTrial: Boolean(subRow?.enterprise_in_paid_trial),
        subscriptionStart: toDateOnly(subRow?.current_period_start),
        firstSubscriptionStartDate: subRow?.first_subscription_start_date ?? null,
        trialStartedAt: toDateOnly(
          subRow?.enterprise_trial_starts_at ?? subRow?.trial_ends_at,
        ),
        billingCycle: toAdminBillingCycle(subRow?.billing_cycle),
        branchesUsed: usage?.branches_used ?? 0,
        branchesLimit: limits.branches === -1 ? null : limits.branches,
        studentsUsed: usage?.students_used ?? 0,
        studentsLimit: limits.students === -1 ? null : limits.students,
        storageGbUsed: storageMbToGb(usage?.storage_used_mb ?? 0),
        storageGbLimit:
          limits.storageMB === -1 ? null : storageMbToGb(limits.storageMB),
        assessmentsCreationLocked: Boolean(tenant.assessments_creation_locked),
      };
    });

    return { data: result };
  }

  async getSubscription(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.requireTenant(tenantId);
    await this.subscriptionService.ensureSubscriptionForTenant(tenantId);
    const subRow = await this.fetchSubscriptionRow(tenantId);
    if (!subRow) throw new NotFoundException('Subscription not found');

    const warnings: string[] = [];
    if (
      subRow.plan_id === PlanId.ENTERPRISE &&
      !hasActiveEnterpriseSnapshot(subRow)
    ) {
      warnings.push(
        'Enterprise plan without accepted snapshot — school must accept offer in Billing',
      );
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        subdomain: tenant.code || tenant.domain,
      },
      subscription: this.mapSubscriptionAdmin(subRow),
      notes: [],
      warnings,
    };
  }

  async putEnterpriseOffer(
    tenantId: string,
    dto: PutEnterpriseOfferDto,
  ): Promise<Record<string, unknown>> {
    await this.requireTenant(tenantId);
    await this.subscriptionService.ensureSubscriptionForTenant(tenantId);

    if (dto.paidTrial && dto.accessStartsAt) {
      throw new BadRequestException(
        'paidTrial and accessStartsAt are mutually exclusive',
      );
    }
    if (dto.paidTrial && (dto.paidTrialDays === null || dto.paidTrialDays === undefined)) {
      throw new BadRequestException('paidTrialDays is required when paidTrial is true');
    }
    if (!dto.paidTrial && dto.paidTrialDays !== null && dto.paidTrialDays !== undefined) {
      throw new BadRequestException('paidTrialDays must be null when paidTrial is false');
    }

    const addonMonthly = (
      enabled: boolean | null,
      monthly: number | null,
    ): number | null => (enabled ? monthly : null);

    const patch = {
      enterprise_enabled: dto.enterpriseEnabled,
      enterprise_price: dto.price,
      enterprise_duration_months: dto.durationMonths,
      enterprise_setup_fee: dto.setupFee,
      enterprise_branches_limit: dto.branches,
      enterprise_students_limit: dto.students,
      enterprise_storage_gb_limit: dto.storageGb,
      enterprise_fees_enabled: dto.fees,
      enterprise_library_enabled: dto.library,
      enterprise_behavioural_enabled: dto.behavioural,
      enterprise_uniform_inventory_enabled: dto.uniformInventory,
      enterprise_white_label_enabled: dto.whiteLabel,
      enterprise_google_classroom_enabled: dto.googleClassroom,
      enterprise_fees_monthly: addonMonthly(dto.fees, dto.feesMonthly),
      enterprise_library_monthly: addonMonthly(dto.library, dto.libraryMonthly),
      enterprise_behavioural_monthly: addonMonthly(
        dto.behavioural,
        dto.behaviouralMonthly,
      ),
      enterprise_uniform_inventory_monthly: addonMonthly(
        dto.uniformInventory,
        dto.uniformInventoryMonthly,
      ),
      enterprise_white_label_monthly: addonMonthly(
        dto.whiteLabel,
        dto.whiteLabelMonthly,
      ),
      enterprise_google_classroom_monthly: addonMonthly(
        dto.googleClassroom,
        dto.googleClassroomMonthly,
      ),
      enterprise_paid_trial_enabled: dto.paidTrial,
      enterprise_paid_trial_duration_days: dto.paidTrial
        ? dto.paidTrialDays
        : null,
      enterprise_pre_trial_setup_fee: dto.preTrialSetupFee ?? 0,
      enterprise_post_trial_setup_fee: dto.postTrialSetupFee ?? 0,
      enterprise_access_starts_at: dto.accessStartsAt,
      enterprise_trial_starts_at: dto.trialStartsAt,
      enterprise_prorate_backdated_access: Boolean(dto.prorateBackdatedAccess),
    };

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .update(patch)
      .eq('tenant_id', tenantId)
      .select(ENTERPRISE_SELECT_COLUMNS)
      .single();

    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to update enterprise offer');

    return this.getSubscription(tenantId);
  }

  async deleteEnterpriseOffer(
    tenantId: string,
    force = false,
  ): Promise<{ cleared: boolean }> {
    await this.requireTenant(tenantId);
    const subRow = await this.fetchSubscriptionRow(tenantId);
    if (!subRow) throw new NotFoundException('Subscription not found');

    const hasOffer =
      Boolean(subRow.enterprise_enabled) ||
      toNum(subRow.enterprise_price) !== null;

    if (!hasOffer) {
      return { cleared: false };
    }

    const live =
      subRow.plan_id === PlanId.ENTERPRISE ||
      hasActiveEnterpriseSnapshot(subRow);

    if (live && !force) {
      throw new ConflictException(
        'Enterprise is live; pass force=true to clear pending re-offer only',
      );
    }

    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase
      .from('subscriptions')
      .update(clearEnterpriseOfferPatch())
      .eq('tenant_id', tenantId);
    throwIfDbError(error);

    return { cleared: true };
  }

  private async requireTenant(tenantId: string): Promise<{
    id: string;
    name: string;
    code: string | null;
    domain: string | null;
    email: string | null;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, code, domain, email')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Tenant not found');
    return data as {
      id: string;
      name: string;
      code: string | null;
      domain: string | null;
      email: string | null;
    };
  }

  private async fetchSubscriptionRow(
    tenantId: string,
  ): Promise<(EnterpriseSubscriptionFields & {
    plan_id: string;
    billing_cycle: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    pending_plan_id: string | null;
    pending_billing_cycle: string | null;
  }) | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select(ENTERPRISE_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    throwIfDbError(error);
    return data as unknown as EnterpriseSubscriptionFields & {
      plan_id: string;
      billing_cycle: string;
      status: string;
      current_period_start: string;
      current_period_end: string;
      pending_plan_id: string | null;
      pending_billing_cycle: string | null;
    };
  }

  private mapSubscriptionAdmin(
    row: EnterpriseSubscriptionFields & {
      plan_id: string;
      billing_cycle: string;
      status: string;
      current_period_start: string;
      current_period_end: string;
      pending_plan_id: string | null;
      pending_billing_cycle: string | null;
    },
  ): Record<string, unknown> {
    return {
      planId: row.plan_id,
      billingCycle: toAdminBillingCycle(row.billing_cycle),
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      pendingPlanId: row.pending_plan_id,
      pendingBillingCycle: toAdminBillingCycle(row.pending_billing_cycle),
      setupFeePaidUsd: toNum(row.setup_fee_paid_usd) ?? 0,
      firstSubscriptionStartDate: row.first_subscription_start_date,
      enterpriseEnabled: Boolean(row.enterprise_enabled),
      enterprisePrice: toNum(row.enterprise_price),
      enterpriseDurationMonths: row.enterprise_duration_months,
      enterpriseSetupFee: toNum(row.enterprise_setup_fee) ?? 0,
      enterpriseBranchesLimit: row.enterprise_branches_limit,
      enterpriseStudentsLimit: row.enterprise_students_limit,
      enterpriseStorageGbLimit: toNum(row.enterprise_storage_gb_limit),
      enterpriseFeesEnabled: row.enterprise_fees_enabled,
      enterpriseLibraryEnabled: row.enterprise_library_enabled,
      enterpriseBehaviouralEnabled: row.enterprise_behavioural_enabled,
      enterpriseUniformInventoryEnabled: row.enterprise_uniform_inventory_enabled,
      enterpriseWhiteLabelEnabled: row.enterprise_white_label_enabled,
      enterpriseGoogleClassroomEnabled: row.enterprise_google_classroom_enabled,
      enterpriseFeesMonthly: toNum(row.enterprise_fees_monthly),
      enterpriseLibraryMonthly: toNum(row.enterprise_library_monthly),
      enterpriseBehaviouralMonthly: toNum(row.enterprise_behavioural_monthly),
      enterpriseUniformInventoryMonthly: toNum(
        row.enterprise_uniform_inventory_monthly,
      ),
      enterpriseWhiteLabelMonthly: toNum(row.enterprise_white_label_monthly),
      enterpriseGoogleClassroomMonthly: toNum(
        row.enterprise_google_classroom_monthly,
      ),
      enterprisePaidTrialEnabled: Boolean(row.enterprise_paid_trial_enabled),
      enterprisePaidTrialDurationDays: row.enterprise_paid_trial_duration_days,
      enterprisePreTrialSetupFee: toNum(row.enterprise_pre_trial_setup_fee) ?? 0,
      enterprisePostTrialSetupFee: toNum(row.enterprise_post_trial_setup_fee) ?? 0,
      enterpriseInPaidTrial: Boolean(row.enterprise_in_paid_trial),
      enterpriseAccessStartsAt: row.enterprise_access_starts_at,
      enterpriseTrialStartsAt: row.enterprise_trial_starts_at,
      enterpriseProrateBackdatedAccess: Boolean(
        row.enterprise_prorate_backdated_access,
      ),
      currentEnterprisePrice: toNum(row.current_enterprise_price),
      currentEnterpriseDurationMonths: row.current_enterprise_duration_months,
      currentEnterpriseBranchesLimit: row.current_enterprise_branches_limit,
      currentEnterpriseStudentsLimit: row.current_enterprise_students_limit,
      currentEnterpriseStorageGbLimit: toNum(
        row.current_enterprise_storage_gb_limit,
      ),
      currentEnterpriseFeesEnabled: row.current_enterprise_fees_enabled,
      currentEnterpriseLibraryEnabled: row.current_enterprise_library_enabled,
      currentEnterpriseBehaviouralEnabled:
        row.current_enterprise_behavioural_enabled,
      currentEnterpriseUniformInventoryEnabled:
        row.current_enterprise_uniform_inventory_enabled,
      currentEnterpriseWhiteLabelEnabled:
        row.current_enterprise_white_label_enabled,
      currentEnterpriseGoogleClassroomEnabled:
        row.current_enterprise_google_classroom_enabled,
      accessStartsAt: row.access_starts_at,
      offerChanged: enterpriseOfferDiffersFromActiveTerms(row),
      billingCycleInternal:
        row.billing_cycle === 'yearly'
          ? BillingCycle.YEARLY
          : BillingCycle.MONTHLY,
    };
  }
}
