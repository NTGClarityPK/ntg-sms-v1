import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../../common/config/supabase.config';
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
export class IdCardReprintRevenueProvider implements RevenueSourceProvider {
  readonly sourceKey = 'id_card_reprints' as const;

  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async isEnabled(_ctx: RevenueSourceEnabledContext): Promise<boolean> {
    return true;
  }

  async aggregate(params: RevenueAggregateParams): Promise<RevenueProviderAggregateResult> {
    if (params.branchIds.length === 0) {
      return { total: 0, transactionCount: 0, byBranch: {} };
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('id_card_reprints')
      .select('branch_id, fee_charged, printed_at, created_at')
      .in('branch_id', [...params.branchIds])
      .not('fee_charged', 'is', null)
      .gt('fee_charged', 0);
    throwIfDbError(error);

    const byBranch: Record<string, number> = {};
    let total = 0;
    let transactionCount = 0;

    for (const row of (data ?? []) as Array<{
      branch_id: string;
      fee_charged: number;
      printed_at: string;
      created_at: string;
    }>) {
      const eventDate = (row.printed_at ?? row.created_at ?? '').slice(0, 10);
      if (!eventDate || eventDate < params.startDate || eventDate > params.endDate) continue;

      const amt = Number(row.fee_charged || 0);
      if (amt <= 0) continue;
      transactionCount += 1;
      total += amt;
      byBranch[row.branch_id] = (byBranch[row.branch_id] ?? 0) + amt;
    }

    for (const id of params.branchIds) {
      if (byBranch[id] != null) byBranch[id] = roundMoney(byBranch[id]);
    }

    return {
      total: roundMoney(total),
      transactionCount,
      byBranch,
    };
  }
}
