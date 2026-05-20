import type { BillingCycle, PlanId } from '@/types/subscription';

export type PlanTransitionType =
  | 'noop'
  | 'contact-sales'
  | 'upgrade'
  | 'downgrade-scheduled'
  | 'pending-cleared';

const PLAN_ORDER: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function classifyTransition(
  currentPlan: PlanId,
  currentCycle: BillingCycle,
  targetPlan: PlanId,
  targetCycle: BillingCycle,
): PlanTransitionType {
  if (currentPlan === targetPlan && currentCycle === targetCycle) {
    return 'noop';
  }
  if (targetPlan === 'enterprise') {
    return 'contact-sales';
  }
  const currentOrder = PLAN_ORDER[currentPlan];
  const targetOrder = PLAN_ORDER[targetPlan];
  if (targetPlan === 'free') {
    return 'downgrade-scheduled';
  }
  if (targetOrder > currentOrder) {
    return 'upgrade';
  }
  if (targetOrder < currentOrder) {
    return 'downgrade-scheduled';
  }
  if (currentCycle === 'monthly' && targetCycle === 'yearly') {
    return 'upgrade';
  }
  return 'downgrade-scheduled';
}

export function planDisplayName(planId: PlanId): string {
  const names: Record<PlanId, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };
  return names[planId];
}

export function marketingPlanNameToId(name: string): PlanId | null {
  const map: Record<string, PlanId> = {
    free: 'free',
    starter: 'starter',
    pro: 'pro',
    enterprise: 'enterprise',
  };
  return map[name.trim().toLowerCase()] ?? null;
}
