import { BillingCycle, PlanId } from '../plan-config';
import type { PlanTransitionType } from '../plan-transition';

export class SubscriptionDto {
  id!: string;
  tenantId!: string;
  planId!: PlanId;
  billingCycle!: BillingCycle;
  status!: string;
  currentPeriodStart!: string;
  currentPeriodEnd!: string;
  trialEndsAt?: string;
  pendingPlanId?: PlanId;
  pendingBillingCycle?: BillingCycle;
  cancelledAt?: string;
  notes?: string;
}

export class SubscriptionUsageDto {
  branchesUsed!: number;
  studentsUsed!: number;
  staffUsed!: number;
  classesUsed!: number;
  storageUsedMb!: number;
  reportsThisMonth!: number;
  smsThisMonth!: number;
  lastResetAt!: string;
}

export class SubscriptionUsageWithLimitsDto {
  usage!: SubscriptionUsageDto;
  limits!: Record<string, number>;
  planId!: PlanId;
}

export class ChangePlanResultDto {
  type!: PlanTransitionType | 'checkout_required';
  subscription?: SubscriptionDto;
  message?: string;
  effectiveDate?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

export class PlanConfigDto {
  id!: PlanId;
  name!: string;
  order!: number;
  limits!: Record<string, number>;
  features!: Record<string, boolean>;
}

export class AdminUpdateSubscriptionDto {
  planId?: PlanId;
  billingCycle?: BillingCycle;
  status?: string;
  notes?: string;
  clearPending?: boolean;
}

export class TenantSubscriptionSummaryDto {
  tenantId!: string;
  tenantName!: string;
  tenantCode!: string;
  subscription!: SubscriptionDto;
  usage!: SubscriptionUsageDto;
}
