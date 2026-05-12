import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class FeeReportsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async getCollectionDashboard(branchId: string, startDate?: string, endDate?: string): Promise<{
    data: {
      collectedVerified: number;
      pendingPayable: number;
      underReviewPayable: number;
      overduePayable: number;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const today = isoDateToday();

    // Verified payments (collected)
    let paymentsQuery = supabase
      .from('fee_payments')
      .select('amount_paid, created_at, payment_date')
      .eq('branch_id', branchId)
      .eq('status', 'Verified');
    if (startDate) paymentsQuery = paymentsQuery.gte('payment_date', startDate);
    if (endDate) paymentsQuery = paymentsQuery.lte('payment_date', endDate);
    const { data: payments, error: pErr } = await paymentsQuery;
    throwIfDbError(pErr);
    const collectedVerified = (payments ?? []).reduce((s, r) => s + Number((r as any).amount_paid || 0), 0);

    // Pending + under review challans
    const { data: challans, error: cErr } = await supabase
      .from('fee_challans')
      .select('payable_amount, status, due_date')
      .eq('branch_id', branchId)
      .in('status', ['Pending_Payment', 'Under_Review']);
    throwIfDbError(cErr);

    let pendingPayable = 0;
    let underReviewPayable = 0;
    let overduePayable = 0;
    for (const r of (challans ?? []) as Array<{ payable_amount: number; status: string; due_date: string }>) {
      const amt = Number(r.payable_amount || 0);
      if (r.status === 'Pending_Payment') pendingPayable += amt;
      if (r.status === 'Under_Review') underReviewPayable += amt;
      if (r.status === 'Pending_Payment' && r.due_date < today) overduePayable += amt;
    }

    return {
      data: {
        collectedVerified: Math.round(collectedVerified * 100) / 100,
        pendingPayable: Math.round(pendingPayable * 100) / 100,
        underReviewPayable: Math.round(underReviewPayable * 100) / 100,
        overduePayable: Math.round(overduePayable * 100) / 100,
      },
    };
  }

  async getDefaulters(branchId: string): Promise<{
    data: Array<{ studentId: string; studentName: string; challanNumber: string; dueDate: string; payableAmount: number }>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const today = isoDateToday();

    const { data: challans, error } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, due_date, payable_amount')
      .eq('branch_id', branchId)
      .eq('status', 'Pending_Payment')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(500);
    throwIfDbError(error);
    const rows = (challans ?? []) as Array<{ challan_number: string; student_id: string; due_date: string; payable_amount: number }>;
    if (rows.length === 0) return { data: [] };

    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('branch_id', branchId)
      .in('id', studentIds);
    throwIfDbError(sErr);
    const nameById = new Map(
      ((students ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((s) => [
        s.id,
        [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
      ]),
    );

    return {
      data: rows.map((r) => ({
        studentId: r.student_id,
        studentName: nameById.get(r.student_id) ?? '—',
        challanNumber: r.challan_number,
        dueDate: r.due_date,
        payableAmount: Number(r.payable_amount),
      })),
    };
  }

  async getDiscountSummary(branchId: string, startDate?: string, endDate?: string): Promise<{
    data: { totalDiscount: number; byTemplate: Array<{ templateId: string; totalDiscount: number }> };
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Filter to verified challans in date range
    let challanQuery = supabase
      .from('fee_challans')
      .select('id, created_at')
      .eq('branch_id', branchId)
      .eq('status', 'Verified');
    if (startDate) challanQuery = challanQuery.gte('created_at', `${startDate}T00:00:00Z`);
    if (endDate) challanQuery = challanQuery.lte('created_at', `${endDate}T23:59:59Z`);
    const { data: challans, error: cErr } = await challanQuery;
    throwIfDbError(cErr);
    const challanIds = (challans ?? []).map((c) => (c as any).id).filter(Boolean);
    if (challanIds.length === 0) {
      return { data: { totalDiscount: 0, byTemplate: [] } };
    }

    const { data: items, error: iErr } = await supabase
      .from('fee_challan_items')
      .select('template_id, amount, is_discount')
      .in('challan_id', challanIds)
      .eq('is_discount', true);
    throwIfDbError(iErr);

    const byTemplate = new Map<string, number>();
    let total = 0;
    for (const r of (items ?? []) as Array<{ template_id: string; amount: number }>) {
      const amt = Math.abs(Number(r.amount || 0));
      total += amt;
      byTemplate.set(r.template_id, (byTemplate.get(r.template_id) ?? 0) + amt);
    }
    return {
      data: {
        totalDiscount: Math.round(total * 100) / 100,
        byTemplate: Array.from(byTemplate.entries()).map(([templateId, totalDiscount]) => ({
          templateId,
          totalDiscount: Math.round(totalDiscount * 100) / 100,
        })),
      },
    };
  }

  async getMonthlyReconciliation(branchId: string, months: string[]): Promise<{
    data: Array<{ month: string; collected: number; pending: number; underReview: number }>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const uniqueMonths = Array.from(new Set(months.map((m) => m.trim()).filter(Boolean)));
    if (uniqueMonths.length === 0) throw new BadRequestException('months is required');

    const { data: challans, error } = await supabase
      .from('fee_challans')
      .select('month, payable_amount, status')
      .eq('branch_id', branchId)
      .in('month', uniqueMonths);
    throwIfDbError(error);

    const map = new Map<string, { collected: number; pending: number; underReview: number }>();
    uniqueMonths.forEach((m) => map.set(m, { collected: 0, pending: 0, underReview: 0 }));
    for (const r of (challans ?? []) as Array<{ month: string; payable_amount: number; status: string }>) {
      const cur = map.get(r.month) ?? { collected: 0, pending: 0, underReview: 0 };
      const amt = Number(r.payable_amount || 0);
      if (r.status === 'Verified') cur.collected += amt;
      else if (r.status === 'Pending_Payment') cur.pending += amt;
      else if (r.status === 'Under_Review') cur.underReview += amt;
      map.set(r.month, cur);
    }

    return {
      data: uniqueMonths.map((m) => {
        const v = map.get(m) ?? { collected: 0, pending: 0, underReview: 0 };
        return {
          month: m,
          collected: Math.round(v.collected * 100) / 100,
          pending: Math.round(v.pending * 100) / 100,
          underReview: Math.round(v.underReview * 100) / 100,
        };
      }),
    };
  }
}

