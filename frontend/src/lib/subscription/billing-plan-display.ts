import type { PlanTransitionType } from '@/lib/subscription/plan-transition';
import type { BillingCycle } from '@/types/subscription';

/** Matches backend YEARLY_DISCOUNT */
export const YEARLY_DISCOUNT_PERCENT = 10;
export const YEARLY_DISCOUNT_RATE = 0.1;

export type MarketingPlanRow = {
  name: string;
  price: string;
  priceNote: string;
  summary: string;
  highlights: { label: string; included: boolean }[];
  popular: boolean;
};

export type PlanLimitDisplay = {
  labelKey: 'branches' | 'students' | 'staff' | 'classes';
  display: string;
};

export type PlanPriceDisplay = {
  mainPrice: string;
  periodSuffix: string;
  subline?: string;
  saveBadge?: string;
  isCustom: boolean;
};

function parsePerStudentMonthlyUsd(price: string): number | null {
  const match = price.match(/\$([\d.]+)/);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

function formatUsd(amount: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatLimitValue(value: number, unlimitedLabel: string): string {
  if (value === -1) return unlimitedLabel;
  return String(value);
}

export function buildPlanLimitRows(
  limits: {
    branches: number;
    students: number;
    staff: number;
    classes: number;
  },
  unlimitedLabel: string,
): PlanLimitDisplay[] {
  const rows: Array<{ labelKey: PlanLimitDisplay['labelKey']; value: number }> = [
    { labelKey: 'branches', value: limits.branches },
    { labelKey: 'students', value: limits.students },
    { labelKey: 'staff', value: limits.staff },
    { labelKey: 'classes', value: limits.classes },
  ];
  return rows.map(({ labelKey, value }) => ({
    labelKey,
    display: formatLimitValue(value, unlimitedLabel),
  }));
}

export type PlanPriceLabelFormatters = {
  perStudentMonth: string;
  perStudentYear: string;
  custom: string;
  /** next-intl: t('whenBilledYearly', { price }) */
  formatWhenBilledYearly: (price: string) => string;
  /** next-intl: t('savePerStudentYear', { amount }) */
  formatSavePerStudentYear: (amount: string) => string;
};

export function getPlanPriceDisplay(
  plan: MarketingPlanRow,
  cycle: BillingCycle,
  labels: PlanPriceLabelFormatters,
): PlanPriceDisplay {
  if (plan.price.toLowerCase().includes('contact')) {
    return { mainPrice: labels.custom, periodSuffix: '', isCustom: true };
  }

  const monthlyRate = parsePerStudentMonthlyUsd(plan.price);
  if (monthlyRate === null || monthlyRate === 0) {
    return {
      mainPrice: '$0',
      periodSuffix: labels.perStudentMonth,
      isCustom: false,
    };
  }

  if (cycle === 'monthly') {
    return {
      mainPrice: plan.price,
      periodSuffix: labels.perStudentMonth,
      isCustom: false,
    };
  }

  const yearlyPerStudent = monthlyRate * 12 * (1 - YEARLY_DISCOUNT_RATE);
  const effectiveMonthly = monthlyRate * (1 - YEARLY_DISCOUNT_RATE);
  const savingsPerStudent = monthlyRate * 12 * YEARLY_DISCOUNT_RATE;

  return {
    mainPrice: formatUsd(yearlyPerStudent, yearlyPerStudent % 1 === 0 ? 0 : 2),
    periodSuffix: labels.perStudentYear,
    subline: labels.formatWhenBilledYearly(
      formatUsd(effectiveMonthly, effectiveMonthly % 1 === 0 ? 0 : 2),
    ),
    saveBadge: labels.formatSavePerStudentYear(
      formatUsd(savingsPerStudent, savingsPerStudent % 1 === 0 ? 0 : 2),
    ),
    isCustom: false,
  };
}

export type PlanActionType =
  | 'current'
  | 'upgrade'
  | 'downgrade'
  | 'select'
  | 'contact-sales';

export function mapTransitionToAction(type: PlanTransitionType): PlanActionType {
  switch (type) {
    case 'noop':
      return 'current';
    case 'upgrade':
      return 'upgrade';
    case 'downgrade-scheduled':
      return 'downgrade';
    case 'contact-sales':
      return 'contact-sales';
    case 'pending-cleared':
      return 'select';
    default:
      return 'select';
  }
}

export function getIncludedFeatureLabels(plan: MarketingPlanRow): string[] {
  const included = plan.highlights.filter((h) => h.included).map((h) => h.label);
  const merged = plan.summary ? [plan.summary, ...included] : included;
  return [...new Set(merged)].slice(0, 6);
}
