/**
 * Authoritative plan limits and features.
 * Limits enforced: branches, students, storageMB only.
 * Enterprise paid add-ons resolved from current_enterprise_* snapshot when live.
 */

export enum PlanId {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export const YEARLY_DISCOUNT = 0.1;

/** Metrics enforced for creates / downgrade checks. */
export type EnforcedLimitMetric = 'branches' | 'students' | 'storageMB';

export interface PlanLimits {
  branches: number;
  students: number;
  staff: number;
  classes: number;
  storageMB: number;
  monthlyReports: number;
  monthlySMS: number;
}

export interface PlanFeatures {
  hasFeeManagement: boolean;
  hasAdvancedReports: boolean;
  hasResultCards: boolean;
  hasParentPortal: boolean;
  hasSMSNotifications: boolean;
  hasTimetable: boolean;
  hasMultiBranch: boolean;
  hasCustomBranding: boolean;
  hasAPIAccess: boolean;
  hasBehavioralTracking: boolean;
  hasLibraryManagement: boolean;
  hasInventoryManagement: boolean;
  hasGoogleClassroom: boolean;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  order: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

const FREE_FEATURES: PlanFeatures = {
  hasFeeManagement: false,
  hasAdvancedReports: true,
  hasResultCards: true,
  hasParentPortal: true,
  hasSMSNotifications: true,
  hasTimetable: true,
  hasMultiBranch: false,
  hasCustomBranding: false,
  hasAPIAccess: false,
  hasBehavioralTracking: false,
  hasLibraryManagement: false,
  hasInventoryManagement: false,
  hasGoogleClassroom: false,
};

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  [PlanId.FREE]: {
    id: PlanId.FREE,
    name: 'Free',
    order: 0,
    limits: {
      branches: 1,
      students: 25,
      staff: -1,
      classes: -1,
      storageMB: 500,
      monthlyReports: -1,
      monthlySMS: -1,
    },
    features: { ...FREE_FEATURES },
  },
  [PlanId.STARTER]: {
    id: PlanId.STARTER,
    name: 'Starter',
    order: 1,
    limits: {
      branches: 1,
      students: 150,
      staff: -1,
      classes: -1,
      storageMB: 3072,
      monthlyReports: -1,
      monthlySMS: -1,
    },
    features: {
      ...FREE_FEATURES,
      hasFeeManagement: true,
    },
  },
  [PlanId.PRO]: {
    id: PlanId.PRO,
    name: 'Pro',
    order: 2,
    limits: {
      branches: -1,
      students: 500,
      staff: -1,
      classes: -1,
      storageMB: 10240,
      monthlyReports: -1,
      monthlySMS: -1,
    },
    features: {
      ...FREE_FEATURES,
      hasFeeManagement: true,
      hasMultiBranch: true,
      hasBehavioralTracking: true,
      hasLibraryManagement: true,
      hasInventoryManagement: true,
      hasCustomBranding: false,
      hasGoogleClassroom: false,
    },
  },
  [PlanId.ENTERPRISE]: {
    id: PlanId.ENTERPRISE,
    name: 'Enterprise',
    order: 3,
    limits: {
      branches: -1,
      students: -1,
      staff: -1,
      classes: -1,
      storageMB: -1,
      monthlyReports: -1,
      monthlySMS: -1,
    },
    // Paid add-ons off until snapshot enables them
    features: {
      ...FREE_FEATURES,
      hasFeeManagement: false,
      hasMultiBranch: true,
      hasBehavioralTracking: false,
      hasLibraryManagement: false,
      hasInventoryManagement: false,
      hasCustomBranding: false,
      hasGoogleClassroom: false,
    },
  },
};

export function parsePlanId(value: string): PlanId | null {
  const normalized = value.toLowerCase();
  if (Object.values(PlanId).includes(normalized as PlanId)) {
    return normalized as PlanId;
  }
  return null;
}

export function getPlanConfig(planId: PlanId): PlanConfig {
  return PLAN_CONFIGS[planId];
}

export function getPlanOrder(planId: PlanId): number {
  return PLAN_CONFIGS[planId].order;
}

export function exceedsLimit(
  planId: PlanId,
  metric: keyof PlanLimits,
  value: number,
  overrideLimits?: Partial<PlanLimits>,
): boolean {
  const limit =
    overrideLimits?.[metric] ?? PLAN_CONFIGS[planId].limits[metric];
  if (limit === -1) return false;
  return value > limit;
}

export function canDowngrade(
  targetPlanId: PlanId,
  currentUsage: Partial<PlanLimits>,
  overrideLimits?: Partial<PlanLimits>,
): { allowed: boolean; reasons: string[] } {
  const config = getPlanConfig(targetPlanId);
  const reasons: string[] = [];
  const enforced: EnforcedLimitMetric[] = ['branches', 'students', 'storageMB'];

  for (const metric of enforced) {
    const value = currentUsage[metric];
    if (value === undefined) continue;
    if (exceedsLimit(targetPlanId, metric, value, overrideLimits)) {
      const limit = overrideLimits?.[metric] ?? config.limits[metric];
      reasons.push(`${metric}: ${value} exceeds ${targetPlanId} limit of ${limit}`);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

export function planHasFeature(
  planId: PlanId,
  feature: keyof PlanFeatures,
): boolean {
  return PLAN_CONFIGS[planId].features[feature];
}

export function listPlanConfigs(): PlanConfig[] {
  return Object.values(PLAN_CONFIGS);
}

export function storageGbToMb(storageGb: number | null | undefined): number {
  if (storageGb === null || storageGb === undefined) return -1;
  return Math.round(Number(storageGb) * 1024);
}

export function storageMbToGb(storageMb: number): number {
  return Math.round((storageMb / 1024) * 1000) / 1000;
}
