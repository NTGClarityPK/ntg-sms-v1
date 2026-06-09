import type {
  RevenueAggregateParams,
  RevenueProviderAggregateResult,
  RevenueSourceEnabledContext,
  RevenueSourceKey,
} from './revenue-source.types';

export interface RevenueSourceProvider {
  readonly sourceKey: RevenueSourceKey;
  isEnabled(ctx: RevenueSourceEnabledContext): Promise<boolean>;
  aggregate(params: RevenueAggregateParams): Promise<RevenueProviderAggregateResult>;
}
