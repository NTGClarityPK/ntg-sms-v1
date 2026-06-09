import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../../common/config/supabase.config';
import { SubscriptionService } from '../../subscription/subscription.service';
import { parsePlanId, planHasFeature } from '../../subscription/plan-config';
import type { RevenueSourceProvider } from './revenue-source.provider';
import type {
  RevenueAggregateParams,
  RevenueProviderAggregateResult,
  RevenueSourceEnabledContext,
} from './revenue-source.types';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class FeeManagementRevenueProvider implements RevenueSourceProvider {
  readonly sourceKey = 'fee_management' as const;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async isEnabled(ctx: RevenueSourceEnabledContext): Promise<boolean> {
    if (!ctx.tenantId) return false;
    const subscription = await this.subscriptionService.getByTenantId(ctx.tenantId);
    const planId = parsePlanId(subscription.planId);
    return !!planId && planHasFeature(planId, 'hasFeeManagement');
  }

  async aggregate(params: RevenueAggregateParams): Promise<RevenueProviderAggregateResult> {
    if (params.branchIds.length === 0) {
      return { total: 0, transactionCount: 0, byBranch: {}, meta: { byPaymentMethod: [] } };
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_payments')
      .select('branch_id, amount_paid, payment_method, payment_date')
      .in('branch_id', [...params.branchIds])
      .eq('status', 'Verified')
      .gte('payment_date', params.startDate)
      .lte('payment_date', params.endDate);
    throwIfDbError(error);

    const byBranch: Record<string, number> = {};
    const methodTotals = new Map<string, number>();
    let total = 0;
    let transactionCount = 0;

    for (const row of (data ?? []) as Array<{
      branch_id: string;
      amount_paid: number;
      payment_method: string;
    }>) {
      const amt = Number(row.amount_paid || 0);
      if (amt <= 0) continue;
      transactionCount += 1;
      total += amt;
      byBranch[row.branch_id] = (byBranch[row.branch_id] ?? 0) + amt;
      const method = row.payment_method || 'Unknown';
      methodTotals.set(method, (methodTotals.get(method) ?? 0) + amt);
    }

    for (const id of params.branchIds) {
      if (byBranch[id] != null) byBranch[id] = roundMoney(byBranch[id]);
    }

    return {
      total: roundMoney(total),
      transactionCount,
      byBranch,
      meta: {
        byPaymentMethod: Array.from(methodTotals.entries()).map(([methodKey, methodTotal]) => ({
          methodKey,
          total: roundMoney(methodTotal),
        })),
      },
    };
  }
}
