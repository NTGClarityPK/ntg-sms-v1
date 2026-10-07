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
  labelKey: 'branches' | 'students' | 'storage';
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
    storageMB: number;
  },
  unlimitedLabel: string,
): PlanLimitDisplay[] {
  const storageDisplay =
    limits.storageMB === -1
      ? unlimitedLabel
      : limits.storageMB >= 1024
        ? `${(limits.storageMB / 1024).toFixed(limits.storageMB % 1024 === 0 ? 0 : 1)} GB`
        : `${limits.storageMB} MB`;

  return [
    {
      labelKey: 'branches',
      display: formatLimitValue(limits.branches, unlimitedLabel),
    },
    {
      labelKey: 'students',
      display: formatLimitValue(limits.students, unlimitedLabel),
    },
    { labelKey: 'storage', display: storageDisplay },
  ];
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
  | 'contact-sales'
  | 'start-trial'
  | 'apply-terms'
  | 'subscribe-enterprise';

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

/** Enterprise card CTA when an Ops offer is pending / changed. */
export function enterpriseOfferAction(input: {
  planId: string;
  offerEnabled?: boolean;
  offerPrice?: number | null;
  offerChanged?: boolean;
  paidTrialEnabled?: boolean;
  inPaidTrial?: boolean;
}): PlanActionType {
  if (!input.offerEnabled || !input.offerPrice || input.offerPrice <= 0) {
    return 'contact-sales';
  }
  if (input.paidTrialEnabled && !input.inPaidTrial && input.planId !== 'enterprise') {
    return 'start-trial';
  }
  if (input.planId === 'enterprise' && input.offerChanged) {
    return 'apply-terms';
  }
  if (input.planId !== 'enterprise') {
    return input.paidTrialEnabled ? 'start-trial' : 'subscribe-enterprise';
  }
  return 'subscribe-enterprise';
}

export function formatOfferLimit(
  value: number | null | undefined,
  unlimitedLabel: string,
  unit?: 'gb',
): string {
  if (value === null || value === undefined) return unlimitedLabel;
  if (unit === 'gb') return `${value} GB`;
  return String(value);
}

export function getIncludedFeatureLabels(plan: MarketingPlanRow): string[] {
  const included = plan.highlights.filter((h) => h.included).map((h) => h.label);
  const merged = plan.summary ? [plan.summary, ...included] : included;
  return [...new Set(merged)].slice(0, 6);
}
