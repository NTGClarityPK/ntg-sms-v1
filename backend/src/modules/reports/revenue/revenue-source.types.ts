/** Stable keys for revenue sources — add new keys when integrating modules (e.g. uniform_inventory). */
export type RevenueSourceKey = 'fee_management' | 'id_card_reprints';

export const REVENUE_SOURCE_PROVIDERS = Symbol('REVENUE_SOURCE_PROVIDERS');

export interface RevenueAggregateParams {
  branchIds: readonly string[];
  startDate: string;
  endDate: string;
  tenantId: string | null;
}

export interface RevenueProviderAggregateResult {
  total: number;
  transactionCount: number;
  byBranch: Record<string, number>;
  meta?: Record<string, unknown>;
}

export interface RevenueSourceEnabledContext {
  tenantId: string | null;
}
