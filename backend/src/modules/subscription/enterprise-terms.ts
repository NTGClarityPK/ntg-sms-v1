import {
  getPlanConfig,
  PlanId,
  storageGbToMb,
  type PlanFeatures,
  type PlanLimits,
} from './plan-config';

/** Raw subscription row fields used for Enterprise offer / live snapshot. */
export type EnterpriseSubscriptionFields = {
  plan_id: string;
  enterprise_enabled: boolean | null;
  enterprise_price: number | string | null;
  enterprise_duration_months: number | null;
  enterprise_setup_fee: number | string | null;
  enterprise_branches_limit: number | null;
  enterprise_students_limit: number | null;
  enterprise_storage_gb_limit: number | string | null;
  enterprise_fees_enabled: boolean | null;
  enterprise_library_enabled: boolean | null;
  enterprise_behavioural_enabled: boolean | null;
  enterprise_uniform_inventory_enabled: boolean | null;
  enterprise_white_label_enabled: boolean | null;
  enterprise_google_classroom_enabled: boolean | null;
  enterprise_fees_monthly: number | string | null;
  enterprise_library_monthly: number | string | null;
  enterprise_behavioural_monthly: number | string | null;
  enterprise_uniform_inventory_monthly: number | string | null;
  enterprise_white_label_monthly: number | string | null;
  enterprise_google_classroom_monthly: number | string | null;
  enterprise_paid_trial_enabled: boolean | null;
  enterprise_paid_trial_duration_days: number | null;
  enterprise_pre_trial_setup_fee: number | string | null;
  enterprise_post_trial_setup_fee: number | string | null;
  enterprise_in_paid_trial: boolean | null;
  enterprise_access_starts_at: string | null;
  enterprise_trial_starts_at: string | null;
  enterprise_prorate_backdated_access: boolean | null;
  current_enterprise_price: number | string | null;
  current_enterprise_duration_months: number | null;
  current_enterprise_branches_limit: number | null;
  current_enterprise_students_limit: number | null;
  current_enterprise_storage_gb_limit: number | string | null;
  current_enterprise_fees_enabled: boolean | null;
  current_enterprise_library_enabled: boolean | null;
  current_enterprise_behavioural_enabled: boolean | null;
  current_enterprise_uniform_inventory_enabled: boolean | null;
  current_enterprise_white_label_enabled: boolean | null;
  current_enterprise_google_classroom_enabled: boolean | null;
  current_enterprise_fees_monthly: number | string | null;
  current_enterprise_library_monthly: number | string | null;
  current_enterprise_behavioural_monthly: number | string | null;
  current_enterprise_uniform_inventory_monthly: number | string | null;
  current_enterprise_white_label_monthly: number | string | null;
  current_enterprise_google_classroom_monthly: number | string | null;
  access_starts_at: string | null;
  setup_fee_paid_usd: number | string | null;
  first_subscription_start_date: string | null;
  trial_ends_at: string | null;
};

export function toNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function hasActiveEnterpriseSnapshot(
  row: Pick<EnterpriseSubscriptionFields, 'current_enterprise_price'>,
): boolean {
  return toNum(row.current_enterprise_price) !== null;
}

export function resolvePlanLimits(
  planId: PlanId,
  row: EnterpriseSubscriptionFields | null,
): PlanLimits {
  const base = { ...getPlanConfig(planId).limits };
  if (planId === PlanId.ENTERPRISE && row && hasActiveEnterpriseSnapshot(row)) {
    base.branches =
      row.current_enterprise_branches_limit === null
        ? -1
        : (row.current_enterprise_branches_limit ?? -1);
    base.students =
      row.current_enterprise_students_limit === null
        ? -1
        : (row.current_enterprise_students_limit ?? -1);
    base.storageMB = storageGbToMb(
      toNum(row.current_enterprise_storage_gb_limit),
    );
  }
  return base;
}

export function resolvePlanFeatures(
  planId: PlanId,
  row: EnterpriseSubscriptionFields | null,
): PlanFeatures {
  const base = { ...getPlanConfig(planId).features };
  if (planId === PlanId.ENTERPRISE && row && hasActiveEnterpriseSnapshot(row)) {
    base.hasFeeManagement = Boolean(row.current_enterprise_fees_enabled);
    base.hasLibraryManagement = Boolean(row.current_enterprise_library_enabled);
    base.hasBehavioralTracking = Boolean(
      row.current_enterprise_behavioural_enabled,
    );
    base.hasInventoryManagement = Boolean(
      row.current_enterprise_uniform_inventory_enabled,
    );
    base.hasCustomBranding = Boolean(row.current_enterprise_white_label_enabled);
    base.hasGoogleClassroom = Boolean(
      row.current_enterprise_google_classroom_enabled,
    );
    base.hasMultiBranch = true;
  }
  return base;
}

export function enterpriseOfferDiffersFromActiveTerms(
  row: EnterpriseSubscriptionFields,
): boolean {
  if (!hasActiveEnterpriseSnapshot(row)) {
    const price = toNum(row.enterprise_price);
    const duration = row.enterprise_duration_months;
    return Boolean(row.enterprise_enabled && price && price > 0 && duration && duration > 0);
  }

  const pairs: Array<[unknown, unknown]> = [
    [toNum(row.enterprise_price), toNum(row.current_enterprise_price)],
    [row.enterprise_duration_months, row.current_enterprise_duration_months],
    [row.enterprise_branches_limit, row.current_enterprise_branches_limit],
    [row.enterprise_students_limit, row.current_enterprise_students_limit],
    [
      toNum(row.enterprise_storage_gb_limit),
      toNum(row.current_enterprise_storage_gb_limit),
    ],
    [row.enterprise_fees_enabled, row.current_enterprise_fees_enabled],
    [row.enterprise_library_enabled, row.current_enterprise_library_enabled],
    [
      row.enterprise_behavioural_enabled,
      row.current_enterprise_behavioural_enabled,
    ],
    [
      row.enterprise_uniform_inventory_enabled,
      row.current_enterprise_uniform_inventory_enabled,
    ],
    [
      row.enterprise_white_label_enabled,
      row.current_enterprise_white_label_enabled,
    ],
    [
      row.enterprise_google_classroom_enabled,
      row.current_enterprise_google_classroom_enabled,
    ],
  ];

  return pairs.some(([a, b]) => a !== b);
}

export function snapshotFromOffer(
  row: EnterpriseSubscriptionFields,
): Record<string, unknown> {
  return {
    current_enterprise_price: row.enterprise_price,
    current_enterprise_duration_months: row.enterprise_duration_months,
    current_enterprise_branches_limit: row.enterprise_branches_limit,
    current_enterprise_students_limit: row.enterprise_students_limit,
    current_enterprise_storage_gb_limit: row.enterprise_storage_gb_limit,
    current_enterprise_fees_enabled: row.enterprise_fees_enabled ?? false,
    current_enterprise_library_enabled: row.enterprise_library_enabled ?? false,
    current_enterprise_behavioural_enabled:
      row.enterprise_behavioural_enabled ?? false,
    current_enterprise_uniform_inventory_enabled:
      row.enterprise_uniform_inventory_enabled ?? false,
    current_enterprise_white_label_enabled:
      row.enterprise_white_label_enabled ?? false,
    current_enterprise_google_classroom_enabled:
      row.enterprise_google_classroom_enabled ?? false,
    current_enterprise_fees_monthly: row.enterprise_fees_monthly,
    current_enterprise_library_monthly: row.enterprise_library_monthly,
    current_enterprise_behavioural_monthly: row.enterprise_behavioural_monthly,
    current_enterprise_uniform_inventory_monthly:
      row.enterprise_uniform_inventory_monthly,
    current_enterprise_white_label_monthly: row.enterprise_white_label_monthly,
    current_enterprise_google_classroom_monthly:
      row.enterprise_google_classroom_monthly,
    access_starts_at: row.enterprise_access_starts_at,
  };
}

export function clearEnterpriseSnapshotPatch(): Record<string, unknown> {
  return {
    current_enterprise_price: null,
    current_enterprise_duration_months: null,
    current_enterprise_branches_limit: null,
    current_enterprise_students_limit: null,
    current_enterprise_storage_gb_limit: null,
    current_enterprise_fees_enabled: null,
    current_enterprise_library_enabled: null,
    current_enterprise_behavioural_enabled: null,
    current_enterprise_uniform_inventory_enabled: null,
    current_enterprise_white_label_enabled: null,
    current_enterprise_google_classroom_enabled: null,
    current_enterprise_fees_monthly: null,
    current_enterprise_library_monthly: null,
    current_enterprise_behavioural_monthly: null,
    current_enterprise_uniform_inventory_monthly: null,
    current_enterprise_white_label_monthly: null,
    current_enterprise_google_classroom_monthly: null,
    access_starts_at: null,
    enterprise_in_paid_trial: false,
  };
}

export function clearEnterpriseOfferPatch(): Record<string, unknown> {
  return {
    enterprise_enabled: false,
    enterprise_price: null,
    enterprise_duration_months: null,
    enterprise_setup_fee: 0,
    enterprise_branches_limit: null,
    enterprise_students_limit: null,
    enterprise_storage_gb_limit: null,
    enterprise_fees_enabled: null,
    enterprise_library_enabled: null,
    enterprise_behavioural_enabled: null,
    enterprise_uniform_inventory_enabled: null,
    enterprise_white_label_enabled: null,
    enterprise_google_classroom_enabled: null,
    enterprise_fees_monthly: null,
    enterprise_library_monthly: null,
    enterprise_behavioural_monthly: null,
    enterprise_uniform_inventory_monthly: null,
    enterprise_white_label_monthly: null,
    enterprise_google_classroom_monthly: null,
    enterprise_paid_trial_enabled: false,
    enterprise_paid_trial_duration_days: null,
    enterprise_pre_trial_setup_fee: 0,
    enterprise_post_trial_setup_fee: 0,
    enterprise_access_starts_at: null,
    enterprise_trial_starts_at: null,
    enterprise_prorate_backdated_access: false,
  };
}

export const ENTERPRISE_SELECT_COLUMNS = [
  'id',
  'tenant_id',
  'plan_id',
  'billing_cycle',
  'status',
  'current_period_start',
  'current_period_end',
  'trial_ends_at',
  'pending_plan_id',
  'pending_billing_cycle',
  'cancelled_at',
  'notes',
  'enterprise_enabled',
  'enterprise_price',
  'enterprise_duration_months',
  'enterprise_setup_fee',
  'enterprise_branches_limit',
  'enterprise_students_limit',
  'enterprise_storage_gb_limit',
  'enterprise_fees_enabled',
  'enterprise_library_enabled',
  'enterprise_behavioural_enabled',
  'enterprise_uniform_inventory_enabled',
  'enterprise_white_label_enabled',
  'enterprise_google_classroom_enabled',
  'enterprise_fees_monthly',
  'enterprise_library_monthly',
  'enterprise_behavioural_monthly',
  'enterprise_uniform_inventory_monthly',
  'enterprise_white_label_monthly',
  'enterprise_google_classroom_monthly',
  'enterprise_paid_trial_enabled',
  'enterprise_paid_trial_duration_days',
  'enterprise_pre_trial_setup_fee',
  'enterprise_post_trial_setup_fee',
  'enterprise_in_paid_trial',
  'enterprise_access_starts_at',
  'enterprise_trial_starts_at',
  'enterprise_prorate_backdated_access',
  'current_enterprise_price',
  'current_enterprise_duration_months',
  'current_enterprise_branches_limit',
  'current_enterprise_students_limit',
  'current_enterprise_storage_gb_limit',
  'current_enterprise_fees_enabled',
  'current_enterprise_library_enabled',
  'current_enterprise_behavioural_enabled',
  'current_enterprise_uniform_inventory_enabled',
  'current_enterprise_white_label_enabled',
  'current_enterprise_google_classroom_enabled',
  'current_enterprise_fees_monthly',
  'current_enterprise_library_monthly',
  'current_enterprise_behavioural_monthly',
  'current_enterprise_uniform_inventory_monthly',
  'current_enterprise_white_label_monthly',
  'current_enterprise_google_classroom_monthly',
  'access_starts_at',
  'setup_fee_paid_usd',
  'first_subscription_start_date',
].join(', ');

export type EnterpriseAcceptMode = 'start_trial' | 'subscribe' | 'apply_terms';

/** Stored on subscription_invoices.notes for Stripe fulfill → applyEnterpriseAcceptance. */
export function formatEnterpriseAcceptInvoiceNotes(
  mode: EnterpriseAcceptMode,
  setupListPrice: number,
): string {
  return `enterprise_accept|mode=${mode}|setupList=${setupListPrice}`;
}

export function parseEnterpriseAcceptInvoiceNotes(
  notes: string | null | undefined,
): { mode: EnterpriseAcceptMode; setupListPrice: number } | null {
  if (!notes || !notes.startsWith('enterprise_accept|')) return null;
  const parts = Object.fromEntries(
    notes
      .split('|')
      .slice(1)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx < 0) return [part, ''];
        return [part.slice(0, idx), part.slice(idx + 1)];
      }),
  );
  const mode = parts.mode as EnterpriseAcceptMode | undefined;
  if (
    mode !== 'start_trial' &&
    mode !== 'subscribe' &&
    mode !== 'apply_terms'
  ) {
    return null;
  }
  const setupListPrice = Number(parts.setupList);
  if (!Number.isFinite(setupListPrice) || setupListPrice < 0) return null;
  return { mode, setupListPrice };
}
