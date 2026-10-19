import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronJobEnabled } from '../../common/config/cron-job-enabled.util';
import { CRON_JOB_ENV_KEYS } from '../../common/config/cron-job-env-keys';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { QueryLateFeesDto } from './dto/query-late-fees.dto';

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

type LateFeeListItem = {
  id: string;
  challanId: string;
  studentName: string;
  classSectionLabel: string;
  billingMonth: string;
  dueDate: string;
  daysOverdue: number | null;
  lateFeeAmount: number;
  appliedAt: string;
  waived: boolean;
  waivedReason: string | null;
  waivedAt: string | null;
  canWaive: boolean;
};

@Injectable()
export class LateFeeService {
  private readonly nightlyJobEnabled: boolean;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly configService: ConfigService,
  ) {
    this.nightlyJobEnabled = isCronJobEnabled(
      this.configService,
      CRON_JOB_ENV_KEYS.lateFeeApplication,
      'production',
    );
  }

  /**
   * Nightly job: apply late fees once per challan for branches with late fees enabled.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async applyLateFeesNightly(): Promise<void> {
    if (!this.nightlyJobEnabled) return;
    const supabase = this.supabaseConfig.getClient();
    const todayIso = new Date().toISOString().slice(0, 10);

    const { data: settingsRows, error: settingsErr } = await supabase
      .from('fee_challan_settings')
      .select('branch_id, late_fee_template_id')
      .eq('late_fees_enabled', true)
      .not('late_fee_template_id', 'is', null);
    throwIfDbError(settingsErr);

    const enabledBranches = (settingsRows ?? []) as Array<{
      branch_id: string;
      late_fee_template_id: string;
    }>;
    if (enabledBranches.length === 0) return;

    const templateIds = Array.from(new Set(enabledBranches.map((s) => s.late_fee_template_id)));
    const { data: templates, error: tErr } = await supabase
      .from('fee_templates')
      .select('id, branch_id, type, is_active, fee_template_metrics(id, amount_type, amount, display_order)')
      .in('id', templateIds)
      .eq('type', 'Fee')
      .eq('is_active', true);
    throwIfDbError(tErr);

    type MetricRow = { id: string; amount_type: string; amount: number; display_order: number };
    const templateById = new Map(
      ((templates ?? []) as Array<{
        id: string;
        branch_id: string;
        fee_template_metrics: MetricRow | MetricRow[] | null;
      }>).map((t) => {
        const metrics = Array.isArray(t.fee_template_metrics)
          ? t.fee_template_metrics
          : t.fee_template_metrics
            ? [t.fee_template_metrics]
            : [];
        const metric = [...metrics].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0] ?? null;
        return [t.id, { branchId: t.branch_id, metric }] as const;
      }),
    );

    const branchTemplate = new Map<string, { templateId: string; metric: MetricRow }>();
    for (const s of enabledBranches) {
      const tpl = templateById.get(s.late_fee_template_id);
      if (!tpl?.metric || tpl.branchId !== s.branch_id) continue;
      branchTemplate.set(s.branch_id, { templateId: s.late_fee_template_id, metric: tpl.metric });
    }
    if (branchTemplate.size === 0) return;

    const branchIds = Array.from(branchTemplate.keys());
    const { data: challans, error } = await supabase
      .from('fee_challans')
      .select('id, branch_id, student_id, due_date, payable_amount')
      .in('branch_id', branchIds)
      .eq('status', 'Pending_Payment')
      .lt('due_date', todayIso);
    throwIfDbError(error);

    const challanList = (challans ?? []) as Array<{
      id: string;
      branch_id: string;
      student_id: string;
      due_date: string;
      payable_amount: number;
    }>;
    if (challanList.length === 0) return;

    const challanIds = challanList.map((c) => c.id);

    const [{ data: payments }, { data: existingLate, error: lateErr }] = await Promise.all([
      supabase
        .from('fee_payments')
        .select('challan_id')
        .in('challan_id', challanIds)
        .in('status', ['Pending_Review', 'Verified']),
      supabase.from('fee_late_fee_applications').select('challan_id').in('challan_id', challanIds),
    ]);
    throwIfDbError(lateErr);

    const blockedChallanIds = new Set((payments ?? []).map((p) => (p as { challan_id: string }).challan_id));
    const alreadyApplied = new Set(
      (existingLate ?? []).map((r) => (r as { challan_id: string }).challan_id),
    );

    for (const c of challanList) {
      if (blockedChallanIds.has(c.id) || alreadyApplied.has(c.id)) continue;

      const cfg = branchTemplate.get(c.branch_id);
      if (!cfg) continue;

      const daysOverdue = daysBetween(c.due_date, todayIso);
      let lateAmount = 0;
      if (cfg.metric.amount_type === 'Percentage') {
        lateAmount = (Number(c.payable_amount) * Number(cfg.metric.amount)) / 100;
      } else {
        lateAmount = Number(cfg.metric.amount);
      }
      lateAmount = Math.round(lateAmount * 100) / 100;
      if (lateAmount <= 0) continue;

      const { data: app, error: appErr } = await supabase
        .from('fee_late_fee_applications')
        .insert({
          branch_id: c.branch_id,
          challan_id: c.id,
          template_id: cfg.templateId,
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
        template_id: cfg.templateId,
        metric_id: cfg.metric.id,
        billing_month: null,
        description: `Late fee (${daysOverdue} days overdue)`,
        item_type: 'Fee',
        amount: lateAmount,
        is_discount: false,
        display_order: 9999,
      });

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

  async list(
    branchId: string,
    query: QueryLateFeesDto,
  ): Promise<{
    data: LateFeeListItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      summary: {
        activeCount: number;
        activeAmount: number;
        waivedThisMonthCount: number;
        waivedThisMonthAmount: number;
        lateFeesConfigured: boolean;
      };
    };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const status = query.status ?? 'all';

    const { data: settings } = await supabase
      .from('fee_challan_settings')
      .select('late_fees_enabled, late_fee_template_id')
      .eq('branch_id', branchId)
      .maybeSingle();
    const lateFeesConfigured = !!(
      (settings as { late_fees_enabled?: boolean; late_fee_template_id?: string | null } | null)
        ?.late_fees_enabled &&
      (settings as { late_fee_template_id?: string | null } | null)?.late_fee_template_id
    );

    let classFilterStudentIds: string[] | null = null;
    if (query.classSectionId) {
      const { data: cs, error: csErr } = await supabase
        .from('class_sections')
        .select('class_id, section_id')
        .eq('id', query.classSectionId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(csErr);
      if (!cs) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            summary: {
              activeCount: 0,
              activeAmount: 0,
              waivedThisMonthCount: 0,
              waivedThisMonthAmount: 0,
              lateFeesConfigured,
            },
          },
        };
      }
      const classId = (cs as { class_id: string }).class_id;
      const sectionId = (cs as { section_id: string }).section_id;
      const { data: students, error: stErr } = await supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .eq('class_id', classId)
        .eq('section_id', sectionId);
      throwIfDbError(stErr);
      classFilterStudentIds = ((students ?? []) as Array<{ id: string }>).map((s) => s.id);
      if (classFilterStudentIds.length === 0) {
        const summary = await this.buildSummary(branchId, lateFeesConfigured);
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0, summary },
        };
      }
    }

    let searchStudentIds: string[] | null = null;
    const search = query.search?.trim();
    if (search) {
      const { data: students, error: searchErr } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('branch_id', branchId);
      throwIfDbError(searchErr);
      const q = search.toLowerCase();
      searchStudentIds = ((students ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>)
        .filter((s) => {
          const name = [s.first_name, s.last_name].filter(Boolean).join(' ').toLowerCase();
          return name.includes(q);
        })
        .map((s) => s.id);
      if (searchStudentIds.length === 0) {
        const summary = await this.buildSummary(branchId, lateFeesConfigured);
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0, summary },
        };
      }
    }

    let studentIdFilter: string[] | null = null;
    if (classFilterStudentIds && searchStudentIds) {
      const set = new Set(searchStudentIds);
      studentIdFilter = classFilterStudentIds.filter((id) => set.has(id));
      if (studentIdFilter.length === 0) {
        const summary = await this.buildSummary(branchId, lateFeesConfigured);
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0, summary },
        };
      }
    } else if (classFilterStudentIds) {
      studentIdFilter = classFilterStudentIds;
    } else if (searchStudentIds) {
      studentIdFilter = searchStudentIds;
    }

    let challanIdFilter: string[] | null = null;
    if (query.month || studentIdFilter) {
      let challanQuery = supabase
        .from('fee_challans')
        .select('id')
        .eq('branch_id', branchId);
      if (query.month) challanQuery = challanQuery.eq('month', query.month);
      if (studentIdFilter) challanQuery = challanQuery.in('student_id', studentIdFilter);
      const { data: challans, error: cErr } = await challanQuery;
      throwIfDbError(cErr);
      challanIdFilter = ((challans ?? []) as Array<{ id: string }>).map((c) => c.id);
      if (challanIdFilter.length === 0) {
        const summary = await this.buildSummary(branchId, lateFeesConfigured);
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0, summary },
        };
      }
    }

    let countQuery = supabase
      .from('fee_late_fee_applications')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId);
    let listQuery = supabase
      .from('fee_late_fee_applications')
      .select(
        'id, challan_id, amount, days_overdue, created_at, waived, waived_reason, waived_at, can_be_waived, template_id',
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (status === 'active') {
      countQuery = countQuery.eq('waived', false);
      listQuery = listQuery.eq('waived', false);
    } else if (status === 'waived') {
      countQuery = countQuery.eq('waived', true);
      listQuery = listQuery.eq('waived', true);
    }
    if (challanIdFilter) {
      countQuery = countQuery.in('challan_id', challanIdFilter);
      listQuery = listQuery.in('challan_id', challanIdFilter);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    listQuery = listQuery.range(from, to);

    const [{ count, error: countErr }, { data: rows, error: listErr }] = await Promise.all([
      countQuery,
      listQuery,
    ]);
    throwIfDbError(countErr);
    throwIfDbError(listErr);

    const apps = (rows ?? []) as Array<{
      id: string;
      challan_id: string;
      amount: number;
      days_overdue: number | null;
      created_at: string;
      waived: boolean;
      waived_reason: string | null;
      waived_at: string | null;
      can_be_waived: boolean;
      template_id: string;
    }>;

    const challanIds = Array.from(new Set(apps.map((a) => a.challan_id)));
    type ChallanInfo = {
      id: string;
      student_id: string;
      month: string;
      due_date: string;
      status: string;
    };
    let challansById = new Map<string, ChallanInfo>();
    if (challanIds.length > 0) {
      const { data: challans, error: cErr } = await supabase
        .from('fee_challans')
        .select('id, student_id, month, due_date, status')
        .eq('branch_id', branchId)
        .in('id', challanIds);
      throwIfDbError(cErr);
      challansById = new Map(((challans ?? []) as ChallanInfo[]).map((c) => [c.id, c]));
    }

    const studentIds = Array.from(new Set(Array.from(challansById.values()).map((c) => c.student_id)));
    type StudentInfo = {
      id: string;
      first_name: string | null;
      last_name: string | null;
      class_id: string | null;
      section_id: string | null;
    };
    let studentsById = new Map<string, StudentInfo>();
    if (studentIds.length > 0) {
      const { data: students, error: sErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, section_id')
        .eq('branch_id', branchId)
        .in('id', studentIds);
      throwIfDbError(sErr);
      studentsById = new Map(((students ?? []) as StudentInfo[]).map((s) => [s.id, s]));
    }

    const classIds = Array.from(
      new Set(
        Array.from(studentsById.values())
          .map((s) => s.class_id)
          .filter((id): id is string => !!id),
      ),
    );
    const sectionIds = Array.from(
      new Set(
        Array.from(studentsById.values())
          .map((s) => s.section_id)
          .filter((id): id is string => !!id),
      ),
    );

    const [classesRes, sectionsRes, paymentsRes] = await Promise.all([
      classIds.length
        ? supabase.from('classes').select('id, name').eq('branch_id', branchId).in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      sectionIds.length
        ? supabase.from('sections').select('id, name').eq('branch_id', branchId).in('id', sectionIds)
        : Promise.resolve({ data: [], error: null }),
      challanIds.length
        ? supabase
            .from('fee_payments')
            .select('challan_id, status')
            .eq('branch_id', branchId)
            .in('challan_id', challanIds)
            .in('status', ['Pending_Review', 'Verified'])
        : Promise.resolve({ data: [], error: null }),
    ]);
    throwIfDbError(classesRes.error);
    throwIfDbError(sectionsRes.error);
    throwIfDbError(paymentsRes.error);

    const classNameById = new Map(
      ((classesRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
    );
    const sectionNameById = new Map(
      ((sectionsRes.data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]),
    );
    const blockedByPayment = new Set(
      ((paymentsRes.data ?? []) as Array<{ challan_id: string }>).map((p) => p.challan_id),
    );

    const data: LateFeeListItem[] = apps.map((app) => {
      const challan = challansById.get(app.challan_id);
      const student = challan ? studentsById.get(challan.student_id) : undefined;
      const studentName = student
        ? [student.first_name, student.last_name].filter(Boolean).join(' ') || '—'
        : '—';
      const className = student?.class_id ? classNameById.get(student.class_id) : null;
      const sectionName = student?.section_id ? sectionNameById.get(student.section_id) : null;
      const classSectionLabel =
        className && sectionName ? `${className}-${sectionName}` : className || sectionName || '—';
      const canWaive =
        !app.waived &&
        !!app.can_be_waived &&
        !!challan &&
        challan.status === 'Pending_Payment' &&
        !blockedByPayment.has(app.challan_id);

      return {
        id: app.id,
        challanId: app.challan_id,
        studentName,
        classSectionLabel,
        billingMonth: challan?.month ?? '—',
        dueDate: challan?.due_date ?? '',
        daysOverdue: app.days_overdue ?? null,
        lateFeeAmount: Number(app.amount),
        appliedAt: app.created_at,
        waived: !!app.waived,
        waivedReason: app.waived_reason ?? null,
        waivedAt: app.waived_at ?? null,
        canWaive,
      };
    });

    const total = count ?? 0;
    const summary = await this.buildSummary(branchId, lateFeesConfigured);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        summary,
      },
    };
  }

  /** @deprecated Prefer list() — kept for any callers of the old recent endpoint. */
  async listRecent(branchId: string) {
    return this.list(branchId, { page: 1, limit: 100, status: 'all', sortOrder: 'desc' });
  }

  async waive(input: {
    lateFeeId: string;
    reason: string;
    waivedBy: string;
    branchId: string;
  }): Promise<{ data: { success: boolean } }> {
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException('Waive reason is required');

    const supabase = this.supabaseConfig.getClient();

    const { data: app, error } = await supabase
      .from('fee_late_fee_applications')
      .select('id, challan_id, amount, waived, can_be_waived, template_id')
      .eq('id', input.lateFeeId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!app) throw new NotFoundException('Late fee application not found');
    const row = app as {
      id: string;
      challan_id: string;
      amount: number;
      waived: boolean;
      can_be_waived: boolean;
      template_id: string;
    };
    if (row.waived) return { data: { success: true } };
    if (!row.can_be_waived) throw new BadRequestException('This late fee cannot be waived');

    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, status')
      .eq('id', row.challan_id)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Fee bill not found');
    if ((challan as { status: string }).status !== 'Pending_Payment') {
      throw new BadRequestException('Late fee can only be waived while the bill is pending payment');
    }

    const { data: payments } = await supabase
      .from('fee_payments')
      .select('id')
      .eq('branch_id', input.branchId)
      .eq('challan_id', row.challan_id)
      .in('status', ['Pending_Review', 'Verified'])
      .limit(1);
    if ((payments ?? []).length > 0) {
      throw new BadRequestException('Late fee cannot be waived while a payment is under review or verified');
    }

    await supabase
      .from('fee_late_fee_applications')
      .update({
        waived: true,
        waived_by: input.waivedBy,
        waived_at: new Date().toISOString(),
        waived_reason: reason,
      })
      .eq('id', input.lateFeeId)
      .eq('branch_id', input.branchId);

    await supabase
      .from('fee_challan_items')
      .delete()
      .eq('challan_id', row.challan_id)
      .eq('template_id', row.template_id)
      .eq('amount', row.amount);

    const { data: items, error: itErr } = await supabase
      .from('fee_challan_items')
      .select('amount, is_discount')
      .eq('challan_id', row.challan_id);
    throwIfDbError(itErr);
    const fees = (items ?? [])
      .filter((i: { is_discount: boolean }) => !i.is_discount)
      .reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0);
    const discounts = (items ?? [])
      .filter((i: { is_discount: boolean }) => i.is_discount)
      .reduce((s: number, i: { amount: number }) => s + Math.abs(Number(i.amount)), 0);
    const payable = Math.max(0, Math.round((fees - discounts) * 100) / 100);

    await supabase
      .from('fee_challans')
      .update({ payable_amount: payable, subtotal: fees, total_discount: discounts })
      .eq('id', row.challan_id)
      .eq('branch_id', input.branchId);

    return { data: { success: true } };
  }

  private async buildSummary(
    branchId: string,
    lateFeesConfigured: boolean,
  ): Promise<{
    activeCount: number;
    activeAmount: number;
    waivedThisMonthCount: number;
    waivedThisMonthAmount: number;
    lateFeesConfigured: boolean;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

    const [{ data: activeRows, error: activeErr }, { data: waivedRows, error: waivedErr }] =
      await Promise.all([
        supabase
          .from('fee_late_fee_applications')
          .select('amount')
          .eq('branch_id', branchId)
          .eq('waived', false),
        supabase
          .from('fee_late_fee_applications')
          .select('amount')
          .eq('branch_id', branchId)
          .eq('waived', true)
          .gte('waived_at', monthStart)
          .lt('waived_at', nextMonth),
      ]);
    throwIfDbError(activeErr);
    throwIfDbError(waivedErr);

    const active = (activeRows ?? []) as Array<{ amount: number }>;
    const waived = (waivedRows ?? []) as Array<{ amount: number }>;

    return {
      activeCount: active.length,
      activeAmount: Math.round(active.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
      waivedThisMonthCount: waived.length,
      waivedThisMonthAmount: Math.round(waived.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
      lateFeesConfigured,
    };
  }
}
