import { BillingCycle, PlanId, YEARLY_DISCOUNT } from './plan-config';

/** Per-student monthly rate in USD cents (aligned with marketing plans.ts). */
export const PER_STUDENT_MONTHLY_CENTS: Record<PlanId, number | null> = {
  [PlanId.FREE]: 0,
  [PlanId.STARTER]: 300,
  [PlanId.PRO]: 200,
  [PlanId.ENTERPRISE]: null,
};

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

export interface InvoiceAmountBreakdown {
  amountCents: number;
  currency: string;
  lineItems: InvoiceLineItem[];
}

export function calculateSubscriptionInvoiceAmount(
  planId: PlanId,
  billingCycle: BillingCycle,
  studentsUsed: number,
): InvoiceAmountBreakdown | null {
  const unitMonthly = PER_STUDENT_MONTHLY_CENTS[planId];
  if (unitMonthly === null || planId === PlanId.ENTERPRISE) {
    return null;
  }
  if (unitMonthly === 0 || studentsUsed <= 0) {
    return {
      amountCents: 0,
      currency: 'USD',
      lineItems: [],
    };
  }

  const quantity = studentsUsed;
  let unitAmountCents: number;
  let periodLabel: string;

  if (billingCycle === BillingCycle.YEARLY) {
    const yearlyPerStudent = Math.round(unitMonthly * 12 * (1 - YEARLY_DISCOUNT));
    unitAmountCents = yearlyPerStudent;
    periodLabel = 'per student / year';
  } else {
    unitAmountCents = unitMonthly;
    periodLabel = 'per student / month';
  }

  const amountCents = unitAmountCents * quantity;
  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);

  return {
    amountCents,
    currency: 'USD',
    lineItems: [
      {
        description: `${planName} plan — ${periodLabel}`,
        quantity,
        unitAmountCents,
        amountCents,
      },
    ],
  };
}

export function formatCentsToDisplay(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}
