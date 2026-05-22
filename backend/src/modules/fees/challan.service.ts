import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { FeeCalculationService } from './fee-calculation.service';
import { FeePdfService } from './fee-pdf.service';
import { StudentPlacementService } from '../../common/services/student-placement.service';

type StudentRow = {
  id: string;
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  class_id?: string | null;
  section_id?: string | null;
};

type ChallanRow = {
  id: string;
  challan_number: string;
  student_id: string;
  month: string;
  months_included: string[] | null;
  generation_date: string;
  due_date: string;
  billing_start_date?: string | null;
  billing_end_date?: string | null;
  subtotal: number;
  total_discount: number;
  payable_amount: number;
  status: string;
  pdf_url: string | null;
  created_at: string;
};

type ChallanItemInsert = {
  challan_id: string;
  template_id: string;
  metric_id: string | null;
  billing_month: string | null;
  description: string;
  item_type: 'Fee' | 'Discount';
  amount: number;
  is_discount: boolean;
  display_order: number;
};

type TemplateCandidateRow = {
  template_id: string;
  scope_type: 'Level' | 'Class' | 'Section';
  scope_id: string;
};

type FeeTemplateSummaryRow = {
  id: string;
  name: string;
  type: 'Fee' | 'Discount';
  scope: string;
  currency_code: 'PKR' | 'IQD' | 'SAR' | 'USD';
};

type FeeTemplateMetricSummaryRow = {
  id: string;
  template_id: string;
  name: string;
  amount_type: 'Absolute' | 'Percentage';
  amount: number;
  per_day: boolean;
  display_order: number;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  if (error.code === '23505') throw new ConflictException('Duplicate record');
  throw new BadRequestException(error.message);
}

function parseMonth(month: string): { year: number; monthIndex: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new BadRequestException('Invalid month format (expected YYYY-MM)');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new BadRequestException('Invalid month value');
  return { year, monthIndex };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class ChallanService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly feeCalculationService: FeeCalculationService,
    private readonly feePdfService: FeePdfService,
    private readonly studentPlacementService: StudentPlacementService,
  ) {}

  async enqueueGenerateJob(
    input: {
      studentIds: string[];
      months: string[];
      dueDate?: string;
      autoCalculateDueDate?: boolean;
      selectedInheritedTemplateId?: string;
      studentOverrides?: Array<{
        studentId: string;
        month: string;
        includeIndividualTemplateIds?: string[];
        templateEdits?: Array<{ templateId: string; action: 'exclude' }>;
        metricEdits?: Array<{ templateId: string; metricId: string; action: 'exclude' | 'overrideAmount'; amount?: number }>;
      }>;
    },
    branchId: string,
    createdByUserId: string,
  ): Promise<{ data: { jobId: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const studentIds = (input.studentIds ?? []).filter(Boolean);
    const months = (input.months ?? []).filter(Boolean);
    if (studentIds.length === 0) throw new BadRequestException('studentIds are required');
    if (months.length === 0) throw new BadRequestException('months are required');

    const payload = {
      studentIds,
      months,
      dueDate: input.dueDate,
      autoCalculateDueDate: input.autoCalculateDueDate,
      selectedInheritedTemplateId: input.selectedInheritedTemplateId,
      studentOverrides: input.studentOverrides,
    };

    const { data, error } = await supabase
      .from('fee_challan_generation_jobs')
      .insert({
        branch_id: branchId,
        created_by: createdByUserId,
        status: 'queued',
        payload,
        total_students: studentIds.length,
        processed_students: 0,
      })
      .select('id')
      .single();
    throwIfDbError(error);
    const id = (data as { id: string } | null)?.id ?? null;
    if (!id) throw new BadRequestException('Failed to enqueue challan generation job');
    return { data: { jobId: id } };
  }

  async getGenerateJob(
    jobId: string,
    branchId: string,
  ): Promise<{
    data: {
      id: string;
      status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
      totalStudents: number;
      processedStudents: number;
      errorMessage: string | null;
      result: unknown | null;
      createdAt: string;
      updatedAt: string;
    };
  }> {
    const id = (jobId ?? '').trim();
    if (!id) throw new BadRequestException('jobId is required');
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challan_generation_jobs')
      .select('id, status, total_students, processed_students, error_message, result, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Job not found');
    const row = data as {
      id: string;
      status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
      total_students: number;
      processed_students: number;
      error_message: string | null;
      result: unknown | null;
      created_at: string;
      updated_at: string;
    };
    return {
      data: {
        id: row.id,
        status: row.status,
        totalStudents: Number(row.total_students ?? 0),
        processedStudents: Number(row.processed_students ?? 0),
        errorMessage: row.error_message ?? null,
        result: row.result ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  }

  private async getBranchBusinessInfo(branchId: string): Promise<{
    branchName: string;
    schoolName: string;
    address: string;
    phone: string;
    email: string;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch, error: bErr } = await supabase
      .from('branches')
      .select('id, tenant_id, name, address, phone, email')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(bErr);

    const branchRow = branch as
      | { tenant_id?: string | null; name?: string | null; address?: string | null; phone?: string | null; email?: string | null }
      | null;

    const tenantId = branchRow?.tenant_id ?? null;
    let schoolName = '';
    if (tenantId) {
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();
      throwIfDbError(tErr);
      schoolName = (tenant as { name?: string | null } | null)?.name ?? '';
    }

    return {
      branchName: branchRow?.name ?? '—',
      schoolName: schoolName || branchRow?.name || '—',
      address: branchRow?.address ?? '',
      phone: branchRow?.phone ?? '',
      email: branchRow?.email ?? '',
    };
  }

  private async getFeeChallanSettings(branchId: string): Promise<{
    challanTemplate: 'Minimal' | 'Modern';
    bankName: string | null;
    accountTitle: string | null;
    accountNumber: string | null;
    bankBranchCode: string | null;
    paymentInstructions: string | null;
    footerText: string | null;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challan_settings')
      .select(
        'challan_template, bank_name, account_title, account_number, bank_branch_code, payment_instructions, footer_text',
      )
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);

    const row = (data ?? null) as
      | {
          challan_template?: 'Minimal' | 'Modern' | null;
          bank_name?: string | null;
          account_title?: string | null;
          account_number?: string | null;
          bank_branch_code?: string | null;
          payment_instructions?: string | null;
          footer_text?: string | null;
        }
      | null;

    return {
      challanTemplate: row?.challan_template ?? 'Minimal',
      bankName: row?.bank_name ?? null,
      accountTitle: row?.account_title ?? null,
      accountNumber: row?.account_number ?? null,
      bankBranchCode: row?.bank_branch_code ?? null,
      paymentInstructions: row?.payment_instructions ?? null,
      footerText: row?.footer_text ?? null,
    };
  }

  private async getBranchName(branchId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    return (data as { name?: string } | null)?.name ?? '—';
  }

  private async getStudent(studentId: string, branchId: string): Promise<StudentRow> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Student not found');
    return data as StudentRow;
  }

  /**
   * Human-friendly challan reference: CHL-YYYY-MM-{roll} (branch uniqueness enforced in DB).
   * Roll = students.student_id (admission / roll), normalised for PDFs and bank narration.
   */
  private normaliseRollForChallanNumber(raw: string | null | undefined): string {
    const trimmed = (raw ?? '').trim().toUpperCase();
    const alnum = trimmed.replace(/[^A-Z0-9]/g, '');
    return alnum.length > 0 ? alnum.slice(0, 20) : '';
  }

  /**
   * @param duplicationSuffix 0 = base number; 1 → …-2, 2 → …-3 (used after unique-violation retries).
   */
  private buildFeeChallanNumber(billingMonthYm: string, rollSegment: string, studentUuid: string, duplicationSuffix: number): string {
    const ym = billingMonthYm.trim();
    const roll =
      rollSegment.length > 0
        ? rollSegment
        : `U${studentUuid.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const core = `CHL-${ym}-${roll}`;
    if (duplicationSuffix <= 0) return core;
    return `${core}-${duplicationSuffix + 1}`;
  }

  private async isMonthCovered(studentId: string, month: string, branchId: string): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challan_month_coverage')
      .select('id')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .eq('month', month)
      .limit(1);
    throwIfDbError(error);
    return (data ?? []).length > 0;
  }

  async getInheritedTemplateCandidates(
    input: { classId: string; sectionId: string },
    branchId: string,
  ): Promise<{
    data: {
      level: Array<{
        templateId: string;
        name: string;
        type: 'Fee' | 'Discount';
        scope: string;
        currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
        assignedScopeId: string;
        metrics: Array<{
          id: string;
          name: string;
          amountType: 'Absolute' | 'Percentage';
          amount: number;
          perDay: boolean;
          displayOrder: number;
        }>;
      }>;
      class: Array<{
        templateId: string;
        name: string;
        type: 'Fee' | 'Discount';
        scope: string;
        currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
        assignedScopeId: string;
        metrics: Array<{
          id: string;
          name: string;
          amountType: 'Absolute' | 'Percentage';
          amount: number;
          perDay: boolean;
          displayOrder: number;
        }>;
      }>;
      classSection: Array<{
        templateId: string;
        name: string;
        type: 'Fee' | 'Discount';
        scope: string;
        currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
        assignedScopeId: string;
        metrics: Array<{
          id: string;
          name: string;
          amountType: 'Absolute' | 'Percentage';
          amount: number;
          perDay: boolean;
          displayOrder: number;
        }>;
      }>;
      discounts: {
        level: Array<{
          templateId: string;
          name: string;
          type: 'Discount';
          scope: string;
          currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
          assignedScopeId: string;
          metrics: Array<{
            id: string;
            name: string;
            amountType: 'Absolute' | 'Percentage';
            amount: number;
            perDay: boolean;
            displayOrder: number;
          }>;
        }>;
        class: Array<{
          templateId: string;
          name: string;
          type: 'Discount';
          scope: string;
          currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
          assignedScopeId: string;
          metrics: Array<{
            id: string;
            name: string;
            amountType: 'Absolute' | 'Percentage';
            amount: number;
            perDay: boolean;
            displayOrder: number;
          }>;
        }>;
        classSection: Array<{
          templateId: string;
          name: string;
          type: 'Discount';
          scope: string;
          currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
          assignedScopeId: string;
          metrics: Array<{
            id: string;
            name: string;
            amountType: 'Absolute' | 'Percentage';
            amount: number;
            perDay: boolean;
            displayOrder: number;
          }>;
        }>;
      };
    };
  }> {
    const classId = (input.classId ?? '').trim();
    const sectionId = (input.sectionId ?? '').trim();
    if (!classId) throw new BadRequestException('classId is required');
    if (!sectionId) throw new BadRequestException('sectionId is required');

    const supabase = this.supabaseConfig.getClient();

    // Resolve classSectionId (fee_template_assignments uses scope_id=class_section_id for Section scope)
    const { data: classSectionRows, error: csErr } = await supabase
      .from('class_sections')
      .select('id')
      .eq('branch_id', branchId)
      .eq('class_id', classId)
      .eq('section_id', sectionId)
      // Defensive: tolerate accidental duplicates; pick most recent.
      .order('created_at', { ascending: false })
      .limit(1);
    throwIfDbError(csErr);
    const classSectionId =
      ((classSectionRows?.[0] as { id?: string } | undefined)?.id ?? null) || null;
    if (!classSectionId) throw new BadRequestException('Class section not found for this branch');

    const { data: levelClasses, error: lcErr } = await supabase
      .from('level_classes')
      .select('level_id')
      .eq('class_id', classId)
      // Defensive: tolerate duplicates; pick first.
      .limit(1);
    throwIfDbError(lcErr);
    const levelId = ((levelClasses?.[0] as { level_id?: string } | undefined)?.level_id ?? null) || null;

    const [levelAssign, classAssign, sectionAssign] = await Promise.all([
      levelId
        ? supabase
            .from('fee_template_assignments')
            .select('template_id, scope_type, scope_id')
            .eq('branch_id', branchId)
            .eq('scope_type', 'Level')
            .eq('scope_id', levelId)
        : Promise.resolve({ data: [] as any[], error: null }),
      supabase
        .from('fee_template_assignments')
        .select('template_id, scope_type, scope_id')
        .eq('branch_id', branchId)
        .eq('scope_type', 'Class')
        .eq('scope_id', classId),
      supabase
        .from('fee_template_assignments')
        .select('template_id, scope_type, scope_id')
        .eq('branch_id', branchId)
        .eq('scope_type', 'Section')
        .eq('scope_id', classSectionId),
    ]);
    throwIfDbError(levelAssign.error as PostgrestError | null);
    throwIfDbError(classAssign.error as PostgrestError | null);
    throwIfDbError(sectionAssign.error as PostgrestError | null);

    const allAssignments = [
      ...((levelAssign.data ?? []) as TemplateCandidateRow[]),
      ...((classAssign.data ?? []) as TemplateCandidateRow[]),
      ...((sectionAssign.data ?? []) as TemplateCandidateRow[]),
    ];

    const templateIds = Array.from(new Set(allAssignments.map((a) => a.template_id).filter(Boolean)));
    if (templateIds.length === 0) {
      return { data: { level: [], class: [], classSection: [], discounts: { level: [], class: [], classSection: [] } } };
    }

    const { data: templates, error: tErr } = await supabase
      .from('fee_templates')
      .select('id, name, type, scope, currency_code')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .in('id', templateIds);
    throwIfDbError(tErr);

    const templateById = new Map<string, FeeTemplateSummaryRow>(
      ((templates ?? []) as FeeTemplateSummaryRow[]).map((t) => [t.id, t]),
    );

    const { data: metricRows, error: mErr } = await supabase
      .from('fee_template_metrics')
      .select('id, template_id, name, amount_type, amount, per_day, display_order')
      .in('template_id', templateIds)
      .order('display_order', { ascending: true });
    throwIfDbError(mErr);

    const metricsByTemplateId = new Map<string, FeeTemplateMetricSummaryRow[]>();
    for (const row of (metricRows ?? []) as FeeTemplateMetricSummaryRow[]) {
      const list = metricsByTemplateId.get(row.template_id) ?? [];
      list.push(row);
      metricsByTemplateId.set(row.template_id, list);
    }

    const level: Array<{
      templateId: string;
      name: string;
      type: 'Fee' | 'Discount';
      scope: string;
      currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
      assignedScopeId: string;
      metrics: Array<{ id: string; name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay: boolean; displayOrder: number }>;
    }> = [];
    const klass: Array<{
      templateId: string;
      name: string;
      type: 'Fee' | 'Discount';
      scope: string;
      currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
      assignedScopeId: string;
      metrics: Array<{ id: string; name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay: boolean; displayOrder: number }>;
    }> = [];
    const classSectionTemplates: Array<{
      templateId: string;
      name: string;
      type: 'Fee' | 'Discount';
      scope: string;
      currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
      assignedScopeId: string;
      metrics: Array<{ id: string; name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay: boolean; displayOrder: number }>;
    }> = [];
    const discountLevel: Array<{
      templateId: string;
      name: string;
      type: 'Discount';
      scope: string;
      currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
      assignedScopeId: string;
      metrics: Array<{ id: string; name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay: boolean; displayOrder: number }>;
    }> = [];
    const discountClass: Array<{
      templateId: string;
      name: string;
      type: 'Discount';
      scope: string;
      currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
      assignedScopeId: string;
      metrics: Array<{ id: string; name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay: boolean; displayOrder: number }>;
    }> = [];
    const discountClassSection: Array<{
      templateId: string;
      name: string;
      type: 'Discount';
      scope: string;
      currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
      assignedScopeId: string;
      metrics: Array<{ id: string; name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay: boolean; displayOrder: number }>;
    }> = [];

    for (const a of allAssignments) {
      const tpl = templateById.get(a.template_id);
      if (!tpl) continue;
      // Only inherited scopes participate in this modal (exclude Individual)
      if (tpl.scope === 'Individual') continue;
      const metrics = (metricsByTemplateId.get(tpl.id) ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        amountType: m.amount_type,
        amount: Number(m.amount),
        perDay: Boolean(m.per_day),
        displayOrder: Number(m.display_order),
      }));
      const row = {
        templateId: tpl.id,
        name: tpl.name,
        type: tpl.type,
        scope: tpl.scope,
        currencyCode: tpl.currency_code,
        assignedScopeId: a.scope_id,
        metrics,
      };
      if (tpl.type === 'Discount') {
        const dRow = row as typeof discountLevel[number];
        if (a.scope_type === 'Section') discountClassSection.push(dRow);
        else if (a.scope_type === 'Class') discountClass.push(dRow);
        else discountLevel.push(dRow);
      } else {
        if (a.scope_type === 'Section') classSectionTemplates.push(row);
        else if (a.scope_type === 'Class') klass.push(row);
        else level.push(row);
      }
    }

    return {
      data: {
        level,
        class: klass,
        classSection: classSectionTemplates,
        discounts: { level: discountLevel, class: discountClass, classSection: discountClassSection },
      },
    };
  }

  async generate(
    input: {
      studentIds: string[];
      months: string[];
      dueDate?: string;
      autoCalculateDueDate?: boolean;
      billingStartDate?: string;
      billingEndDate?: string;
      selectedInheritedTemplateId?: string;
      studentOverrides?: Array<{
        studentId: string;
        month: string;
        includeIndividualTemplateIds?: string[];
        templateEdits?: Array<{
          templateId: string;
          action: 'exclude';
        }>;
        metricEdits?: Array<{
          templateId: string;
          metricId: string;
          action: 'exclude' | 'overrideAmount';
          amount?: number;
        }>;
      }>;
    },
    branchId: string,
  ): Promise<{ data: Array<{ studentId: string; challanId: string; challanNumber: string; pdfUrl: string | null }> }> {
    const months = Array.from(new Set(input.months.map((m) => m.trim()))).sort();
    if (months.length === 0) throw new BadRequestException('Months are required');

    // Validate months early
    months.forEach((m) => parseMonth(m));

    const primaryMonth = months[0];
    const { year, monthIndex } = parseMonth(primaryMonth);

    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const defaultBillingStartIso = isoDate(monthStart);
    const defaultBillingEndIso = isoDate(monthEnd);

    const customBillingStartIso = input.billingStartDate ? input.billingStartDate.slice(0, 10) : null;
    const customBillingEndIso = input.billingEndDate ? input.billingEndDate.slice(0, 10) : null;
    const billingStartIso = customBillingStartIso ?? defaultBillingStartIso;
    const billingEndIso = customBillingEndIso ?? defaultBillingEndIso;
    if ((customBillingStartIso && !customBillingEndIso) || (!customBillingStartIso && customBillingEndIso)) {
      throw new BadRequestException('Billing period requires both start and end dates');
    }
    // Validate custom billing dates are within the primary billing month.
    if (customBillingStartIso && customBillingEndIso) {
      if (billingEndIso < billingStartIso) {
        throw new BadRequestException('Invalid billing period (end before start)');
      }
      if (billingStartIso < defaultBillingStartIso || billingEndIso > defaultBillingEndIso) {
        throw new BadRequestException('Billing period must be within the selected month');
      }
    }

    let dueDateIso: string;
    if (input.dueDate) {
      dueDateIso = input.dueDate.slice(0, 10);
    } else {
      const daysUntilDue = 30;
      dueDateIso = isoDate(addDays(monthStart, (input.autoCalculateDueDate ?? true) ? daysUntilDue : daysUntilDue));
    }

    const supabase = this.supabaseConfig.getClient();
    const branchName = await this.getBranchName(branchId);
    const businessInfo = await this.getBranchBusinessInfo(branchId);
    const challanSettings = await this.getFeeChallanSettings(branchId);

    const results: Array<{ studentId: string; challanId: string; challanNumber: string; pdfUrl: string | null }> = [];

    for (const studentId of input.studentIds) {
      type StudentOverride = NonNullable<typeof input.studentOverrides>[number];
      const overridesForStudentMonth = new Map<string, StudentOverride>();
      for (const o of input.studentOverrides ?? []) {
        if (!o?.studentId || !o?.month) continue;
        if (o.studentId !== studentId) continue;
        overridesForStudentMonth.set(o.month.trim(), o);
      }

      // Skip months already covered by verified multi-month payments
      const coveredChecks = await Promise.all(months.map((m) => this.isMonthCovered(studentId, m, branchId)));
      if (coveredChecks.some(Boolean)) {
        continue;
      }

      // Prevent duplicates: pending/under-review for same primary month
      const { data: existing, error: exErr } = await supabase
        .from('fee_challans')
        .select('id, challan_number, pdf_url, due_date, subtotal, total_discount, payable_amount, status, months_included')
        .eq('branch_id', branchId)
        .eq('student_id', studentId)
        .eq('month', primaryMonth)
        .in('status', ['Pending_Payment', 'Under_Review'])
        .limit(1);
      throwIfDbError(exErr);
      const existingRow = (existing ?? [])[0] as
        | (Pick<
            ChallanRow,
            | 'id'
            | 'challan_number'
            | 'pdf_url'
            | 'due_date'
            | 'subtotal'
            | 'total_discount'
            | 'payable_amount'
            | 'status'
            | 'months_included'
          > & { months_included: string[] | null })
        | undefined;

      if (existingRow) {
        const primaryOverride = overridesForStudentMonth.get(primaryMonth);
        const hasOverrides =
          !!primaryOverride &&
          ((primaryOverride.includeIndividualTemplateIds ?? []).length > 0 ||
            (primaryOverride.templateEdits ?? []).length > 0 ||
            (primaryOverride.metricEdits ?? []).length > 0);

        // Always regenerate PDF for an existing draft challan (same path whether due date or line items changed).
        const student = await this.getStudent(studentId, branchId);
        const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ') || '—';

        const monthsForPdf =
          Array.isArray(existingRow.months_included) && existingRow.months_included.length > 0
            ? existingRow.months_included
            : months;

        // If overrides were provided, rebuild challan items/totals from calculation preview and replace existing items.
        // This is still safe because we only ever find existing challans in Pending_Payment / Under_Review.
        let challanItemsForPdf: Array<{
          billing_month: string | null;
          description: string;
          amount: number;
          is_discount: boolean;
        }> = [];
        let totalsForPdf = {
          subtotal: Number(existingRow.subtotal ?? 0),
          totalDiscount: Number(existingRow.total_discount ?? 0),
          payableAmount: Number(existingRow.payable_amount ?? 0),
        };

        if (hasOverrides) {
          const previews = await Promise.all(
            monthsForPdf.map((m) => {
              const o = overridesForStudentMonth.get(m.trim());
              return this.feeCalculationService.calculatePreview(
                studentId,
                branchId,
                m,
                undefined,
                o
                  ? {
                      forcedInheritedTemplateId: input.selectedInheritedTemplateId,
                      includeIndividualTemplateIds: o.includeIndividualTemplateIds,
                      metricEdits: o.metricEdits,
                      templateEdits: o.templateEdits,
                    }
                  : input.selectedInheritedTemplateId
                    ? { forcedInheritedTemplateId: input.selectedInheritedTemplateId }
                    : undefined,
              );
            }),
          );

          const subtotal = previews.reduce((s, p) => s + p.subtotal, 0);
          const totalDiscount = previews.reduce((s, p) => s + p.totalDiscount, 0);
          const payableAmount = previews.reduce((s, p) => s + p.payableAmount, 0);
          totalsForPdf = { subtotal, totalDiscount, payableAmount };

          const itemsToInsert: ChallanItemInsert[] = [];
          let displayOrder = 0;
          for (const p of previews) {
            for (const it of p.items) {
              itemsToInsert.push({
                challan_id: existingRow.id,
                template_id: it.templateId,
                metric_id: it.metricId ?? null,
                billing_month: p.month,
                description: it.description,
                item_type: it.itemType,
                amount: it.amount,
                is_discount: it.isDiscount,
                display_order: displayOrder++,
              });
            }
          }

          // Replace existing items
          const { error: delErr } = await supabase
            .from('fee_challan_items')
            .delete()
            .eq('challan_id', existingRow.id);
          throwIfDbError(delErr);

          if (itemsToInsert.length > 0) {
            const { error: insErr } = await supabase.from('fee_challan_items').insert(itemsToInsert);
            throwIfDbError(insErr);
          }

          // Update totals on challan
          const { error: updTotalsErr } = await supabase
            .from('fee_challans')
            .update({
              subtotal,
              total_discount: totalDiscount,
              payable_amount: payableAmount,
            })
            .eq('id', existingRow.id)
            .eq('branch_id', branchId);
          throwIfDbError(updTotalsErr);

          challanItemsForPdf = itemsToInsert.map((i) => ({
            billing_month: i.billing_month,
            description: i.description,
            amount: Math.abs(Number(i.amount ?? 0)),
            is_discount: Boolean(i.is_discount),
          }));
        } else {
          const { data: challanItems, error: itemsErr } = await supabase
            .from('fee_challan_items')
            .select('template_id, billing_month, description, amount, is_discount')
            .eq('challan_id', existingRow.id)
            .order('display_order', { ascending: true });
          throwIfDbError(itemsErr);
          challanItemsForPdf = (challanItems ?? []) as any[];
        }

        const templateIds = Array.from(
          new Set(
            (challanItemsForPdf ?? [])
              .map((r) => (r as { template_id?: string | null }).template_id)
              .filter(Boolean) as string[],
          ),
        );
        let currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD' = 'PKR';
        if (templateIds.length > 0) {
          const { data: tplRows, error: tplErr } = await supabase
            .from('fee_templates')
            .select('id, currency_code')
            .eq('branch_id', branchId)
            .in('id', templateIds)
            .limit(1);
          throwIfDbError(tplErr);
          currencyCode = ((tplRows?.[0] as { currency_code?: 'PKR' | 'IQD' | 'SAR' | 'USD' } | undefined)?.currency_code ??
            'PKR') as any;
        }

        const qrPayload = `fee:challan:${existingRow.id}`;
        const pdfBuffer = await this.feePdfService.generateChallanPdf({
          branchName,
          businessInfo,
          challanSettings,
          currencyCode,
          studentName,
          studentStudentId: student.student_id,
          challanNumber: existingRow.challan_number,
          months: monthsForPdf,
          dueDate: dueDateIso,
          billingStartDate: billingStartIso,
          billingEndDate: billingEndIso,
          items: challanItemsForPdf.map((row) => ({
            billingMonth: row.billing_month,
            description: row.description,
            amount: Math.abs(Number(row.amount ?? 0)),
            isDiscount: Boolean(row.is_discount),
          })),
          totals: totalsForPdf,
          qrPayload,
          issuedAt: isoDate(new Date()),
        });

        const filePath = `challans/${branchId}/${existingRow.id}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('fee-documents')
          .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        if (uploadError) {
          // Challan exists but PDF failed; still update due date.
          const { error: updErr } = await supabase
            .from('fee_challans')
            .update({ due_date: dueDateIso })
            .eq('id', existingRow.id)
            .eq('branch_id', branchId);
          throwIfDbError(updErr);

          results.push({
            studentId,
            challanId: existingRow.id,
            challanNumber: existingRow.challan_number,
            pdfUrl: existingRow.pdf_url ?? null,
          });
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('fee-documents').getPublicUrl(filePath);

        const { data: updated, error: updErr } = await supabase
          .from('fee_challans')
          .update({
            due_date: dueDateIso,
            pdf_url: publicUrl,
            billing_start_date: billingStartIso,
            billing_end_date: billingEndIso,
          })
          .eq('id', existingRow.id)
          .eq('branch_id', branchId)
          .select('id, challan_number, pdf_url')
          .single();
        throwIfDbError(updErr);

        results.push({
          studentId,
          challanId: (updated as { id: string }).id,
          challanNumber: (updated as { challan_number: string }).challan_number,
          pdfUrl: (updated as { pdf_url: string | null }).pdf_url,
        });
        continue;
      }

      const student = await this.getStudent(studentId, branchId);
      const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ') || '—';

      const previews = await Promise.all(
        months.map((m) => {
          const o = overridesForStudentMonth.get(m.trim());
          return this.feeCalculationService.calculatePreview(
            studentId,
            branchId,
            m,
            undefined,
            o
              ? {
                  forcedInheritedTemplateId: input.selectedInheritedTemplateId,
                  includeIndividualTemplateIds: o.includeIndividualTemplateIds,
                  metricEdits: o.metricEdits,
                  templateEdits: o.templateEdits,
                }
              : input.selectedInheritedTemplateId
                ? { forcedInheritedTemplateId: input.selectedInheritedTemplateId }
                : undefined,
          );
        }),
      );

      if (previews.every((p) => p.items.length === 0)) {
        // No applicable templates / nothing to charge.
        continue;
      }

      const subtotal = previews.reduce((s, p) => s + p.subtotal, 0);
      const totalDiscount = previews.reduce((s, p) => s + p.totalDiscount, 0);
      const payableAmount = previews.reduce((s, p) => s + p.payableAmount, 0);

      // Insert challan + items atomically (best-effort: single transaction isn't available via PostgREST here).
      let challanNumber: string | null = null;
      let challanRow: { id: string; challan_number: string; pdf_url: string | null } | null = null;
      let lastInsertError: PostgrestError | null = null;
      const rollSegment = this.normaliseRollForChallanNumber(student.student_id);
      for (let attempt = 0; attempt < 5; attempt++) {
        challanNumber = this.buildFeeChallanNumber(primaryMonth, rollSegment, studentId, attempt);
        const { data: inserted, error: insErr } = await supabase
          .from('fee_challans')
          .insert({
            branch_id: branchId,
            challan_number: challanNumber,
            student_id: studentId,
            month: primaryMonth,
            months_included: months,
            generation_date: isoDate(new Date()),
            due_date: dueDateIso,
            billing_start_date: billingStartIso,
            billing_end_date: billingEndIso,
            subtotal,
            total_discount: totalDiscount,
            payable_amount: payableAmount,
            status: 'Pending_Payment',
            pdf_url: null,
          })
          .select('id, challan_number, pdf_url')
          .single();
        if (!insErr && inserted) {
          challanRow = inserted as { id: string; challan_number: string; pdf_url: string | null };
          break;
        }
        lastInsertError = insErr;
        if (insErr?.code === '23505') continue; // retry number collision
        break;
      }
      throwIfDbError(lastInsertError);
      if (!challanRow || !challanNumber) throw new BadRequestException('Failed to generate challan');

      const itemsToInsert: ChallanItemInsert[] = [];
      let displayOrder = 0;
      for (const p of previews) {
        for (const it of p.items) {
          itemsToInsert.push({
            challan_id: challanRow.id,
            template_id: it.templateId,
            metric_id: it.metricId ?? null,
            billing_month: p.month,
            description: it.description,
            item_type: it.itemType,
            amount: it.amount,
            is_discount: it.isDiscount,
            display_order: displayOrder++,
          });
        }
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsErr } = await supabase.from('fee_challan_items').insert(itemsToInsert);
        if (itemsErr) {
          // Roll back challan record if line items fail.
          await supabase.from('fee_challans').delete().eq('id', challanRow.id).eq('branch_id', branchId);
          throwIfDbError(itemsErr);
        }
      }

      const qrPayload = `fee:challan:${challanRow.id}`;
      const templateIds = Array.from(new Set(itemsToInsert.map((i) => i.template_id).filter(Boolean)));
      let currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD' = 'PKR';
      if (templateIds.length > 0) {
        const { data: tplRows, error: tplErr } = await supabase
          .from('fee_templates')
          .select('id, currency_code')
          .eq('branch_id', branchId)
          .in('id', templateIds)
          .limit(1);
        throwIfDbError(tplErr);
        currencyCode = ((tplRows?.[0] as { currency_code?: 'PKR' | 'IQD' | 'SAR' | 'USD' } | undefined)?.currency_code ??
          'PKR') as any;
      }
      const pdfBuffer = await this.feePdfService.generateChallanPdf({
        branchName,
        businessInfo,
        challanSettings,
        currencyCode,
        studentName,
        studentStudentId: student.student_id,
        challanNumber: challanRow.challan_number,
        months,
        dueDate: dueDateIso,
        billingStartDate: billingStartIso,
        billingEndDate: billingEndIso,
        items: itemsToInsert.map((i) => ({
          billingMonth: i.billing_month,
          description: i.description,
          amount: Math.abs(i.amount),
          isDiscount: i.is_discount,
        })),
        totals: { subtotal, totalDiscount, payableAmount },
        qrPayload,
        issuedAt: isoDate(new Date()),
      });

      const filePath = `challans/${branchId}/${challanRow.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('fee-documents')
        .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (uploadError) {
        // Challan exists but PDF failed; keep pdf_url null for retry.
        results.push({
          studentId,
          challanId: challanRow.id,
          challanNumber: challanRow.challan_number,
          pdfUrl: null,
        });
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('fee-documents').getPublicUrl(filePath);

      const { data: updated, error: updErr } = await supabase
        .from('fee_challans')
        .update({ pdf_url: publicUrl })
        .eq('id', challanRow.id)
        .eq('branch_id', branchId)
        .select('id, challan_number, pdf_url')
        .single();
      throwIfDbError(updErr);

      results.push({
        studentId,
        challanId: challanRow.id,
        challanNumber: (updated as { challan_number: string }).challan_number,
        pdfUrl: (updated as { pdf_url: string | null }).pdf_url,
      });
    }

    return { data: results };
  }

  async getById(
    id: string,
    branchId: string,
  ): Promise<{ data: ChallanRow & { items: Array<{ id: string; description: string; amount: number; is_discount: boolean; item_type: string; billing_month: string | null }> } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challans')
      .select(
        'id, challan_number, student_id, month, months_included, generation_date, due_date, subtotal, total_discount, payable_amount, status, pdf_url, created_at, fee_challan_items(id, description, amount, is_discount, item_type, billing_month)',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Challan not found');
    const row = data as ChallanRow & { fee_challan_items: any[] };
    return {
      data: {
        ...row,
        items: (row.fee_challan_items ?? []).map((i) => i as any),
      },
    };
  }

  async listByStudent(
    studentId: string,
    branchId: string,
  ): Promise<{ data: Array<Pick<ChallanRow, 'id' | 'challan_number' | 'month' | 'months_included' | 'due_date' | 'payable_amount' | 'status' | 'pdf_url' | 'created_at'>> }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challans')
      .select('id, challan_number, month, months_included, due_date, payable_amount, status, pdf_url, created_at')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    throwIfDbError(error);
    return { data: (data ?? []) as any[] };
  }

  async listMyStudentsPending(
    parentUserId: string,
    branchId: string,
  ): Promise<{
    data: Array<{
      id: string;
      challanNumber: string;
      studentId: string;
      studentName: string;
      month: string;
      payableAmount: number;
      dueDate: string;
      status: string;
      pdfUrl: string | null;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: links, error: linkErr } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_user_id', parentUserId);
    throwIfDbError(linkErr);
    const studentIds = Array.from(
      new Set((links ?? []).map((r) => (r as { student_id: string }).student_id).filter(Boolean)),
    );
    if (studentIds.length === 0) return { data: [] };

    // NOTE: Parents can belong to multiple branches and may have a stale / different current branch selected.
    // We resolve students by parent link and then query challans across those students' branches.
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, branch_id')
      .in('id', studentIds);
    throwIfDbError(sErr);
    const linkedStudents = (students ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      branch_id: string;
    }>;
    if (linkedStudents.length === 0) return { data: [] };

    const linkedStudentIds = linkedStudents.map((s) => s.id);
    const nameById = new Map(
      linkedStudents.map((s) => [s.id, [s.first_name, s.last_name].filter(Boolean).join(' ') || '—'] as const),
    );
    const branchIds = Array.from(new Set(linkedStudents.map((s) => s.branch_id).filter(Boolean)));
    if (branchIds.length === 0) return { data: [] };

    const { data: challans, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, month, payable_amount, due_date, status, pdf_url')
      .in('branch_id', branchIds)
      .in('student_id', linkedStudentIds)
      .in('status', ['Pending_Payment', 'Under_Review'])
      .order('due_date', { ascending: true });
    throwIfDbError(cErr);

    return {
      data: (challans ?? []).map((c) => {
        const row = c as {
          id: string;
          challan_number: string;
          student_id: string;
          month: string;
          payable_amount: number;
          due_date: string;
          status: string;
          pdf_url: string | null;
        };
        return {
          id: row.id,
          challanNumber: row.challan_number,
          studentId: row.student_id,
          studentName: nameById.get(row.student_id) ?? '—',
          month: row.month,
          payableAmount: Number(row.payable_amount),
          dueDate: row.due_date,
          status: row.status,
          pdfUrl: row.pdf_url,
        };
      }),
    };
  }

  async listStudentPending(
    studentId: string,
    branchId: string,
  ): Promise<{
    data: Array<{
      id: string;
      challanNumber: string;
      studentId: string;
      studentName: string;
      month: string;
      payableAmount: number;
      dueDate: string;
      status: string;
      pdfUrl: string | null;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(sErr);
    if (!student) return { data: [] };
    const sRow = student as { id: string; first_name: string | null; last_name: string | null };
    const studentName = [sRow.first_name, sRow.last_name].filter(Boolean).join(' ') || '—';

    const { data: challans, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, month, payable_amount, due_date, status, pdf_url')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .in('status', ['Pending_Payment', 'Under_Review'])
      .order('due_date', { ascending: true });
    throwIfDbError(cErr);

    return {
      data: (challans ?? []).map((c) => {
        const row = c as {
          id: string;
          challan_number: string;
          student_id: string;
          month: string;
          payable_amount: number;
          due_date: string;
          status: string;
          pdf_url: string | null;
        };
        return {
          id: row.id,
          challanNumber: row.challan_number,
          studentId: row.student_id,
          studentName,
          month: row.month,
          payableAmount: Number(row.payable_amount),
          dueDate: row.due_date,
          status: row.status,
          pdfUrl: row.pdf_url,
        };
      }),
    };
  }

  async getClassSectionRoster(
    input: { classId: string; sectionId: string; month: string },
    branchId: string,
  ): Promise<{
    data: Array<{
      studentId: string;
      studentName: string;
      parentName: string | null;
      parentIsStaff: boolean;
      status: string | null;
      challanId: string | null;
      challanNumber: string | null;
      pdfUrl: string | null;
    }>;
  }> {
    const classId = (input.classId ?? '').trim();
    const sectionId = (input.sectionId ?? '').trim();
    const month = (input.month ?? '').trim();
    if (!classId) throw new BadRequestException('classId is required');
    if (!sectionId) throw new BadRequestException('sectionId is required');
    parseMonth(month); // validates YYYY-MM

    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');

    const studentIds = await this.studentPlacementService.listActiveStudentIdsForClassSection({
      branchId,
      academicYearId: activeYear.id,
      classId,
      sectionId,
    });

    if (studentIds.length === 0) return { data: [] };

    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name')
      .eq('branch_id', branchId)
      .in('id', studentIds)
      .eq('is_active', true)
      .order('first_name', { ascending: true });
    throwIfDbError(sErr);

    const studentRows = (students ?? []) as StudentRow[];
    if (studentRows.length === 0) return { data: [] };
    const filteredStudentIds = studentRows.map((s) => s.id);

    // Parent link (pick primary if available, otherwise lowest priority / oldest)
    const { data: parentLinks, error: plErr } = await supabase
      .from('parent_students')
      .select('student_id, parent_user_id, is_primary, priority, created_at')
      .in('student_id', filteredStudentIds);
    throwIfDbError(plErr);

    const links = (parentLinks ?? []) as Array<{
      student_id: string;
      parent_user_id: string;
      is_primary: boolean | null;
      priority: number | null;
      created_at: string;
    }>;

    const bestParentByStudent = new Map<string, string>();
    const linksByStudent = new Map<string, typeof links>();
    for (const l of links) {
      const arr = linksByStudent.get(l.student_id) ?? [];
      arr.push(l);
      linksByStudent.set(l.student_id, arr);
    }
    for (const sId of filteredStudentIds) {
      const candidates = linksByStudent.get(sId);
      if (!candidates || candidates.length === 0) continue;
      candidates.sort((a, b) => {
        // primary first, then priority asc, then created_at asc
        const ap = a.is_primary ? 0 : 1;
        const bp = b.is_primary ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const apr = a.priority ?? 9999;
        const bpr = b.priority ?? 9999;
        if (apr !== bpr) return apr - bpr;
        return String(a.created_at).localeCompare(String(b.created_at));
      });
      bestParentByStudent.set(sId, candidates[0].parent_user_id);
    }

    const parentUserIds = Array.from(new Set(Array.from(bestParentByStudent.values()).filter(Boolean)));

    const parentNameById = new Map<string, string>();
    if (parentUserIds.length > 0) {
      const { data: profiles, error: prErr } = await supabase.from('profiles').select('id, full_name').in('id', parentUserIds);
      throwIfDbError(prErr);
      for (const p of profiles ?? []) {
        const row = p as { id: string; full_name: string | null };
        if (row.id) parentNameById.set(row.id, row.full_name ?? '—');
      }
    }

    const staffParentIds = new Set<string>();
    if (parentUserIds.length > 0) {
      const { data: staffRows, error: stErr } = await supabase
        .from('staff')
        .select('user_id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .in('user_id', parentUserIds);
      throwIfDbError(stErr);
      for (const r of staffRows ?? []) {
        const uid = (r as { user_id: string }).user_id;
        if (uid) staffParentIds.add(uid);
      }
    }

    // Challan status for the selected month (either primary month or included in multi-month)
    // We fetch by primary month first (month column), then best-effort fallback to months_included containment.
    const { data: challans, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, status, pdf_url, month, months_included, created_at')
      .eq('branch_id', branchId)
      .in('student_id', filteredStudentIds)
      .order('created_at', { ascending: false });
    throwIfDbError(cErr);

    const challanRows = (challans ?? []) as Array<{
      id: string;
      challan_number: string;
      student_id: string;
      status: string;
      pdf_url: string | null;
      month: string;
      months_included: string[] | null;
      created_at: string;
    }>;

    const challanByStudent = new Map<string, (typeof challanRows)[number]>();
    for (const row of challanRows) {
      const covers =
        row.month === month || (Array.isArray(row.months_included) && row.months_included.includes(month));
      if (!covers) continue;
      if (!challanByStudent.has(row.student_id)) challanByStudent.set(row.student_id, row);
    }

    return {
      data: studentRows.map((s) => {
        const studentName = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
        const parentUserId = bestParentByStudent.get(s.id) ?? null;
        const parentName = parentUserId ? parentNameById.get(parentUserId) ?? '—' : null;
        const challan = challanByStudent.get(s.id) ?? null;
        return {
          studentId: s.id,
          studentName,
          parentName,
          parentIsStaff: parentUserId ? staffParentIds.has(parentUserId) : false,
          status: challan?.status ?? null,
          challanId: challan?.id ?? null,
          challanNumber: challan?.challan_number ?? null,
          pdfUrl: challan?.pdf_url ?? null,
        };
      }),
    };
  }
}

