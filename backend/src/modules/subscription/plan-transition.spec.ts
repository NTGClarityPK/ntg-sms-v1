import { BillingCycle, PlanId } from './plan-config';
import { classifyTransition } from './plan-transition';

describe('classifyTransition', () => {
  it('returns noop for same plan and cycle', () => {
    expect(
      classifyTransition(PlanId.PRO, BillingCycle.MONTHLY, PlanId.PRO, BillingCycle.MONTHLY),
    ).toBe('noop');
  });

  it('returns contact-sales for enterprise', () => {
    expect(
      classifyTransition(PlanId.FREE, BillingCycle.MONTHLY, PlanId.ENTERPRISE, BillingCycle.MONTHLY),
    ).toBe('contact-sales');
  });

  it('upgrades free to starter', () => {
    expect(
      classifyTransition(PlanId.FREE, BillingCycle.MONTHLY, PlanId.STARTER, BillingCycle.MONTHLY),
    ).toBe('upgrade');
  });

  it('upgrades free to pro yearly', () => {
    expect(
      classifyTransition(PlanId.FREE, BillingCycle.MONTHLY, PlanId.PRO, BillingCycle.YEARLY),
    ).toBe('upgrade');
  });

  it('upgrades starter monthly to yearly', () => {
    expect(
      classifyTransition(PlanId.STARTER, BillingCycle.MONTHLY, PlanId.STARTER, BillingCycle.YEARLY),
    ).toBe('upgrade');
  });

  it('schedules downgrade pro to free', () => {
    expect(
      classifyTransition(PlanId.PRO, BillingCycle.MONTHLY, PlanId.FREE, BillingCycle.MONTHLY),
    ).toBe('downgrade-scheduled');
  });

  it('schedules downgrade pro to starter', () => {
    expect(
      classifyTransition(PlanId.PRO, BillingCycle.MONTHLY, PlanId.STARTER, BillingCycle.MONTHLY),
    ).toBe('downgrade-scheduled');
  });

  it('schedules downgrade pro yearly to monthly', () => {
    expect(
      classifyTransition(PlanId.PRO, BillingCycle.YEARLY, PlanId.PRO, BillingCycle.MONTHLY),
    ).toBe('downgrade-scheduled');
  });
});
