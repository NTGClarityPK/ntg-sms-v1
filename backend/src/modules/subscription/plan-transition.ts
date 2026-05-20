import {
  BillingCycle,
  getPlanOrder,
  PlanId,
} from './plan-config';

export type PlanTransitionType =
  | 'noop'
  | 'contact-sales'
  | 'upgrade'
  | 'downgrade-scheduled'
  | 'pending-cleared';

export function classifyTransition(
  currentPlan: PlanId,
  currentCycle: BillingCycle,
  targetPlan: PlanId,
  targetCycle: BillingCycle,
): PlanTransitionType {
  if (currentPlan === targetPlan && currentCycle === targetCycle) {
    return 'noop';
  }

  if (targetPlan === PlanId.ENTERPRISE) {
    return 'contact-sales';
  }

  const currentOrder = getPlanOrder(currentPlan);
  const targetOrder = getPlanOrder(targetPlan);

  if (targetPlan === PlanId.FREE) {
    return 'downgrade-scheduled';
  }

  if (targetOrder > currentOrder) {
    return 'upgrade';
  }

  if (targetOrder < currentOrder) {
    return 'downgrade-scheduled';
  }

  if (currentCycle === BillingCycle.MONTHLY && targetCycle === BillingCycle.YEARLY) {
    return 'upgrade';
  }

  return 'downgrade-scheduled';
}
