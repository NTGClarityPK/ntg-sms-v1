import { BillingCycle, PlanId } from './plan-config';
import { calculateSubscriptionInvoiceAmount } from './plan-pricing';

describe('calculateSubscriptionInvoiceAmount', () => {
  it('returns null for enterprise', () => {
    expect(
      calculateSubscriptionInvoiceAmount(PlanId.ENTERPRISE, BillingCycle.MONTHLY, 100),
    ).toBeNull();
  });

  it('returns zero for free plan', () => {
    const result = calculateSubscriptionInvoiceAmount(PlanId.FREE, BillingCycle.MONTHLY, 50);
    expect(result?.amountCents).toBe(0);
  });

  it('calculates starter monthly total', () => {
    const result = calculateSubscriptionInvoiceAmount(
      PlanId.STARTER,
      BillingCycle.MONTHLY,
      10,
    );
    expect(result?.amountCents).toBe(3000);
    expect(result?.lineItems[0]?.quantity).toBe(10);
  });

  it('applies yearly discount for pro', () => {
    const result = calculateSubscriptionInvoiceAmount(
      PlanId.PRO,
      BillingCycle.YEARLY,
      5,
    );
    // $2/student/mo * 12 * 0.9 = $21.60/year per student -> 2160 cents * 5
    expect(result?.amountCents).toBe(10800);
  });
});
