import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseConfig } from '../../common/config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function daysBetween(dueDateIso: string, todayIso: string): number {
  const due = new Date(dueDateIso);
  const now = new Date(todayIso);
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((nowUtc - dueUtc) / (1000 * 60 * 60 * 24)));
}

@Injectable()
export class LateFeeService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  /**
   * Nightly job: apply late fees once per challan.
   * - Only for challans Pending_Payment that are past due.
   * - Skip challans that already have a late fee application.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async applyLateFeesNightly(): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const todayIso = new Date().toISOString().slice(0, 10);

    const { data: challans, error } = await supabase
      .from('fee_challans')
      .select('id, branch_id, student_id, due_date, payable_amount')
      .eq('status', 'Pending_Payment')
      .lt('due_date', todayIso);
    throwIfDbError(error);

    for (const c of (challans ?? []) as Array<{
      id: string;
      branch_id: string;
      student_id: string;
      due_date: string;
      payable_amount: number;
    }>) {
      // Ensure no payment exists for this challan (already under review)
      const { data: payments } = await supabase
        .from('fee_payments')
        .select('id, status')
        .eq('branch_id', c.branch_id)
        .eq('challan_id', c.id)
        .in('status', ['Pending_Review', 'Verified'])
        .limit(1);
      if ((payments ?? []).length > 0) continue;

      const { data: existingLate, error: lateErr } = await supabase
        .from('fee_late_fee_applications')
        .select('id')
        .eq('branch_id', c.branch_id)
        .eq('challan_id', c.id)
        .limit(1);
      throwIfDbError(lateErr);
      if ((existingLate ?? []).length > 0) continue;

      const daysOverdue = daysBetween(c.due_date, todayIso);

      // Find a late fee template in this branch (scope Individual or Levels etc; for now: any Fee template with name includes 'Late Fee' and active auto-apply)
      const { data: templates, error: tErr } = await supabase
        .from('fee_templates')
        .select('id, type, is_active, auto_apply, fee_template_metrics(id, amount_type, amount)')
        .eq('branch_id', c.branch_id)
        .eq('type', 'Fee')
        .eq('is_active', true)
        .eq('auto_apply', true)
        .ilike('name', '%late%fee%')
        .limit(1);
      throwIfDbError(tErr);
      const tpl = (templates ?? [])[0] as any;
      if (!tpl) continue;

      const metric = Array.isArray(tpl.fee_template_metrics) ? tpl.fee_template_metrics[0] : tpl.fee_template_metrics;
      if (!metric) continue;

      let lateAmount = 0;
      if (metric.amount_type === 'Percentage') {
        lateAmount = (Number(c.payable_amount) * Number(metric.amount)) / 100;
      } else {
        lateAmount = Number(metric.amount);
      }
      lateAmount = Math.round(lateAmount * 100) / 100;
      if (lateAmount <= 0) continue;

      const { data: app, error: appErr } = await supabase
        .from('fee_late_fee_applications')
        .insert({
          branch_id: c.branch_id,
          challan_id: c.id,
          template_id: tpl.id,
          amount: lateAmount,
          applied_automatically: true,
          days_overdue: daysOverdue,
          can_be_waived: true,
          waived: false,
        })
        .select('id')
        .single();
      throwIfDbError(appErr);
      if (!app) continue;

      await supabase.from('fee_challan_items').insert({
        challan_id: c.id,
        template_id: tpl.id,
        metric_id: metric.id,
        billing_month: null,
        description: `Late fee (${daysOverdue} days overdue)`,
        item_type: 'Fee',
        amount: lateAmount,
        is_discount: false,
        display_order: 9999,
      });

      // Update challan totals
      await supabase
        .from('fee_challans')
        .update({
          subtotal: Number(c.payable_amount) + lateAmount,
          payable_amount: Number(c.payable_amount) + lateAmount,
        })
        .eq('id', c.id)
        .eq('branch_id', c.branch_id);
    }
  }

  async listRecent(branchId: string): Promise<{
    data: Array<{
      id: string;
      challanId: string;
      lateFeeAmount: number;
      daysOverdue: number | null;
      appliedAt: string;
      waived: boolean;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_late_fee_applications')
      .select('id, challan_id, amount, days_overdue, created_at, waived')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(100);
    throwIfDbError(error);
    return {
      data: ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        challanId: r.challan_id,
        lateFeeAmount: Number(r.amount),
        daysOverdue: r.days_overdue ?? null,
        appliedAt: r.created_at,
        waived: !!r.waived,
      })),
    };
  }

  async waive(input: { lateFeeId: string; reason?: string; waivedBy: string; branchId: string }): Promise<{ data: { success: boolean } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: app, error } = await supabase
      .from('fee_late_fee_applications')
      .select('id, challan_id, amount, waived')
      .eq('id', input.lateFeeId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!app) throw new NotFoundException('Late fee application not found');
    if ((app as any).waived) return { data: { success: true } };

    await supabase
      .from('fee_late_fee_applications')
      .update({ waived: true, waived_by: input.waivedBy, waived_at: new Date().toISOString() })
      .eq('id', input.lateFeeId)
      .eq('branch_id', input.branchId);

    // Remove the challan_item corresponding to this late fee (by template_id match and most recent description)
    await supabase
      .from('fee_challan_items')
      .delete()
      .eq('challan_id', (app as any).challan_id)
      .eq('amount', (app as any).amount);

    // Recalculate challan payable from items (simple sum: fees minus discounts)
    const { data: items, error: itErr } = await supabase
      .from('fee_challan_items')
      .select('amount, is_discount')
      .eq('challan_id', (app as any).challan_id);
    throwIfDbError(itErr);
    const fees = (items ?? []).filter((i: any) => !i.is_discount).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const discounts = (items ?? []).filter((i: any) => i.is_discount).reduce((s: number, i: any) => s + Math.abs(Number(i.amount)), 0);
    const payable = Math.max(0, Math.round((fees - discounts) * 100) / 100);

    await supabase
      .from('fee_challans')
      .update({ payable_amount: payable, subtotal: fees, total_discount: discounts })
      .eq('id', (app as any).challan_id)
      .eq('branch_id', input.branchId);

    return { data: { success: true } };
  }
}

