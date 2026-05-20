/**
 * Authoritative plan limits and features (aligned with marketing plans.ts highlights).
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
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  order: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  [PlanId.FREE]: {
    id: PlanId.FREE,
    name: 'Free',
    order: 0,
    limits: {
      branches: 1,
      students: 50,
      staff: 3,
      classes: 5,
      storageMB: 500,
      monthlyReports: 50,
      monthlySMS: 100,
    },
    features: {
      hasFeeManagement: false,
      hasAdvancedReports: false,
      hasResultCards: false,
      hasParentPortal: true,
      hasSMSNotifications: false,
      hasTimetable: false,
      hasMultiBranch: false,
      hasCustomBranding: false,
      hasAPIAccess: false,
      hasBehavioralTracking: false,
      hasLibraryManagement: false,
      hasInventoryManagement: false,
    },
  },
  [PlanId.STARTER]: {
    id: PlanId.STARTER,
    name: 'Starter',
    order: 1,
    limits: {
      branches: 1,
      students: 300,
      staff: 20,
      classes: 25,
      storageMB: 3072,
      monthlyReports: 500,
      monthlySMS: 1000,
    },
    features: {
      hasFeeManagement: true,
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
      monthlyReports: 2000,
      monthlySMS: 5000,
    },
    features: {
      hasFeeManagement: true,
      hasAdvancedReports: true,
      hasResultCards: true,
      hasParentPortal: true,
      hasSMSNotifications: true,
      hasTimetable: true,
      hasMultiBranch: true,
      hasCustomBranding: true,
      hasAPIAccess: true,
      hasBehavioralTracking: true,
      hasLibraryManagement: true,
      hasInventoryManagement: true,
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
      storageMB: 102400,
      monthlyReports: -1,
      monthlySMS: -1,
    },
    features: {
      hasFeeManagement: true,
      hasAdvancedReports: true,
      hasResultCards: true,
      hasParentPortal: true,
      hasSMSNotifications: true,
      hasTimetable: true,
      hasMultiBranch: true,
      hasCustomBranding: true,
      hasAPIAccess: true,
      hasBehavioralTracking: true,
      hasLibraryManagement: true,
      hasInventoryManagement: true,
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
): boolean {
  const limit = PLAN_CONFIGS[planId].limits[metric];
  if (limit === -1) return false;
  return value > limit;
}

export function canDowngrade(
  targetPlanId: PlanId,
  currentUsage: Partial<PlanLimits>,
): { allowed: boolean; reasons: string[] } {
  const config = getPlanConfig(targetPlanId);
  const reasons: string[] = [];

  (Object.keys(currentUsage) as Array<keyof PlanLimits>).forEach((metric) => {
    const value = currentUsage[metric];
    if (value !== undefined && exceedsLimit(targetPlanId, metric, value)) {
      const limit = config.limits[metric];
      reasons.push(`${metric}: ${value} exceeds ${targetPlanId} limit of ${limit}`);
    }
  });

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
