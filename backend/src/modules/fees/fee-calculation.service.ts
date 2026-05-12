import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import {
  FeeCalculationLineItemDto,
  FeeCalculationPreviewDto,
  FeeMetricExclusionDto,
  FeeStudentTemplateDto,
  FeeStudentTemplateMetricDto,
  FeeStudentTemplatesResponseDto,
} from './dto/fee-student-templates.dto';
import { FeeChallanPreviewDto } from './dto/fee-challan-preview.dto';

type StudentPlacement = {
  classId: string | null;
  sectionId: string | null;
  academicYearId: string | null;
  levelId: string | null;
};

type FeeTemplateRow = {
  id: string;
  name: string;
  type: 'Fee' | 'Discount';
  scope: 'Levels' | 'Class' | 'Class-Section' | 'Individual';
  pro_rate_type: 'Full_Month' | 'Half_Month' | 'Daily_Pro_Rate';
  days_until_due: number;
  auto_apply: boolean;
  auto_apply_condition: Record<string, unknown> | null;
};

type FeeMetricRow = {
  id: string;
  template_id: string;
  name: string;
  amount_type: 'Absolute' | 'Percentage';
  amount: number;
  per_day: boolean;
  display_order: number;
};

type FeeMetricExclusionRow = {
  id: string;
  template_id: string;
  metric_id: string;
  excluded_by: string;
  reason: string | null;
  created_at: string;
};

type StudentTemplateLinkRow = {
  template_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type PreviewOverrides = {
  forcedInheritedTemplateId?: string;
  includeIndividualTemplateIds?: string[];
  metricEdits?: Array<{
    templateId: string;
    metricId: string;
    action: 'exclude' | 'overrideAmount';
    amount?: number;
  }>;
  templateEdits?: Array<{
    templateId: string;
    action: 'exclude';
  }>;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function toMonthString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function parseMonth(month: string): { year: number; monthIndex: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new BadRequestException('Invalid month format (expected YYYY-MM)');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new BadRequestException('Invalid month value');
  return { year, monthIndex };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function daysInclusive(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

@Injectable()
export class FeeCalculationService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  private async getStudentPlacement(studentId: string, branchId: string): Promise<StudentPlacement> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    const activeYearId = activeYear?.id ?? null;

    // Preferred: student_enrolments (year-scoped)
    const { data: enrol, error: enrolErr } = activeYearId
      ? await supabase
          .from('student_enrolments')
          .select('class_id, section_id, academic_year_id')
          .eq('student_id', studentId)
          .eq('branch_id', branchId)
          .eq('academic_year_id', activeYearId)
          .eq('status', 'active')
          .maybeSingle()
      : { data: null, error: null };
    throwIfDbError(enrolErr as PostgrestError | null);

    let classId: string | null = (enrol as { class_id?: string | null } | null)?.class_id ?? null;
    let sectionId: string | null = (enrol as { section_id?: string | null } | null)?.section_id ?? null;
    let academicYearId: string | null =
      (enrol as { academic_year_id?: string | null } | null)?.academic_year_id ?? activeYearId;

    // Fallback: students table
    if (!classId) {
      const { data: student, error } = await supabase
        .from('students')
        .select('id, class_id, section_id, academic_year_id')
        .eq('id', studentId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      if (!student) throw new NotFoundException('Student not found');
      const s = student as { class_id: string | null; section_id: string | null; academic_year_id: string | null };
      classId = s.class_id ?? null;
      sectionId = s.section_id ?? null;
      academicYearId = s.academic_year_id ?? academicYearId;
    }

    let levelId: string | null = null;
    if (classId) {
      const { data: levelClass, error: lcError } = await supabase
        .from('level_classes')
        .select('level_id')
        .eq('class_id', classId)
        .maybeSingle();
      throwIfDbError(lcError);
      levelId = (levelClass as { level_id?: string | null } | null)?.level_id ?? null;
    }

    return { classId, sectionId, academicYearId, levelId };
  }

  private async parentIsStaff(parentUserId: string, branchId: string): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .eq('branch_id', branchId)
      .eq('user_id', parentUserId)
      .eq('is_active', true)
      .limit(1);
    throwIfDbError(error);
    return (data ?? []).length > 0;
  }

  private async studentHasSiblings(studentId: string, branchId: string): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();
    // Sibling definition: any parent linked to this student is also linked to another student in the same branch.
    const { data: links, error } = await supabase
      .from('parent_students')
      .select('parent_user_id')
      .eq('student_id', studentId);
    throwIfDbError(error);
    const parentUserIds = Array.from(
      new Set((links ?? []).map((r) => (r as { parent_user_id: string }).parent_user_id).filter(Boolean)),
    );
    if (parentUserIds.length === 0) return false;

    const { data: siblingLinks, error: sibError } = await supabase
      .from('parent_students')
      .select('parent_user_id, student_id')
      .in('parent_user_id', parentUserIds);
    throwIfDbError(sibError);

    const otherStudentIds = Array.from(
      new Set(
        (siblingLinks ?? [])
          .map((r) => (r as { student_id: string }).student_id)
          .filter((id) => id && id !== studentId),
      ),
    );
    if (otherStudentIds.length === 0) return false;

    const { data: otherStudents, error: osError } = await supabase
      .from('students')
      .select('id')
      .in('id', otherStudentIds)
      .eq('branch_id', branchId);
    throwIfDbError(osError);
    return (otherStudents ?? []).length > 0;
  }

  private async resolveApplicableTemplateIds(
    studentId: string,
    placement: StudentPlacement,
    branchId: string,
  ): Promise<{ inheritedTemplateIds: string[]; individualTemplateIds: string[]; autoApplyTemplateIds: string[] }> {
    const supabase = this.supabaseConfig.getClient();

    const scopeClauses: Array<{ scope_type: 'Level' | 'Class' | 'Section'; scope_id: string }> = [];
    if (placement.levelId) scopeClauses.push({ scope_type: 'Level', scope_id: placement.levelId });
    if (placement.classId) scopeClauses.push({ scope_type: 'Class', scope_id: placement.classId });
    if (placement.sectionId) scopeClauses.push({ scope_type: 'Section', scope_id: placement.sectionId });

    const inheritedTemplateIds = new Set<string>();
    if (scopeClauses.length > 0) {
      // We can't do OR across multiple columns efficiently without building .or(); so do 3 queries in parallel.
      const [levelRes, classRes, sectionRes] = await Promise.all([
        placement.levelId
          ? supabase
              .from('fee_template_assignments')
              .select('template_id')
              .eq('branch_id', branchId)
              .eq('scope_type', 'Level')
              .eq('scope_id', placement.levelId)
          : Promise.resolve({ data: [] as any[], error: null }),
        placement.classId
          ? supabase
              .from('fee_template_assignments')
              .select('template_id')
              .eq('branch_id', branchId)
              .eq('scope_type', 'Class')
              .eq('scope_id', placement.classId)
          : Promise.resolve({ data: [] as any[], error: null }),
        placement.sectionId
          ? supabase
              .from('fee_template_assignments')
              .select('template_id')
              .eq('branch_id', branchId)
              .eq('scope_type', 'Section')
              .eq('scope_id', placement.sectionId)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      throwIfDbError(levelRes.error as PostgrestError | null);
      throwIfDbError(classRes.error as PostgrestError | null);
      throwIfDbError(sectionRes.error as PostgrestError | null);

      for (const r of [...(levelRes.data ?? []), ...(classRes.data ?? []), ...(sectionRes.data ?? [])]) {
        const id = (r as { template_id: string }).template_id;
        if (id) inheritedTemplateIds.add(id);
      }
    }

    const { data: individualLinks, error: indErr } = await supabase
      .from('fee_student_template_links')
      .select('template_id, start_date, end_date, is_active')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .eq('is_active', true);
    throwIfDbError(indErr);

    const individualTemplateIds = new Set<string>(
      ((individualLinks ?? []) as StudentTemplateLinkRow[]).map((l) => l.template_id).filter(Boolean),
    );

    // Auto-apply templates: for now support parent_has_role=staff and student_has_siblings=true per design wireframe.
    const { data: autoTemplates, error: autoErr } = await supabase
      .from('fee_templates')
      .select('id, auto_apply_condition')
      .eq('branch_id', branchId)
      .eq('scope', 'Individual')
      .eq('auto_apply', true)
      .eq('is_active', true);
    throwIfDbError(autoErr);

    const autoApplyTemplateIds = new Set<string>();
    if ((autoTemplates ?? []).length > 0) {
      const { data: parentLinks, error: plErr } = await supabase
        .from('parent_students')
        .select('parent_user_id')
        .eq('student_id', studentId);
      throwIfDbError(plErr);
      const parentUserIds = Array.from(
        new Set((parentLinks ?? []).map((r) => (r as { parent_user_id: string }).parent_user_id).filter(Boolean)),
      );

      const [anyParentStaff, hasSiblings] = await Promise.all([
        parentUserIds.length > 0
          ? (async () => {
              const checks = await Promise.all(parentUserIds.map((pid) => this.parentIsStaff(pid, branchId)));
              return checks.some(Boolean);
            })()
          : Promise.resolve(false),
        this.studentHasSiblings(studentId, branchId),
      ]);

      for (const row of (autoTemplates ?? []) as Array<{ id: string; auto_apply_condition: Record<string, unknown> | null }>) {
        const cond = row.auto_apply_condition ?? {};
        const parentHasRole = typeof cond['parent_has_role'] === 'string' ? (cond['parent_has_role'] as string) : null;
        const studentHasSiblings = typeof cond['student_has_siblings'] === 'boolean' ? (cond['student_has_siblings'] as boolean) : null;
        if (parentHasRole === 'staff' && anyParentStaff) autoApplyTemplateIds.add(row.id);
        if (studentHasSiblings === true && hasSiblings) autoApplyTemplateIds.add(row.id);
      }
    }

    return {
      inheritedTemplateIds: Array.from(inheritedTemplateIds),
      individualTemplateIds: Array.from(individualTemplateIds),
      autoApplyTemplateIds: Array.from(autoApplyTemplateIds),
    };
  }

  private async fetchTemplatesWithMetrics(
    templateIds: string[],
    branchId: string,
  ): Promise<Array<FeeTemplateRow & { metrics: FeeMetricRow[] }>> {
    const supabase = this.supabaseConfig.getClient();
    if (templateIds.length === 0) return [];

    const { data, error } = await supabase
      .from('fee_templates')
      .select(
        'id, name, type, scope, pro_rate_type, days_until_due, auto_apply, auto_apply_condition, fee_template_metrics(id, template_id, name, amount_type, amount, per_day, display_order)',
      )
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .in('id', templateIds);
    throwIfDbError(error);

    return ((data ?? []) as Array<
      FeeTemplateRow & { fee_template_metrics: FeeMetricRow[] }
    >).map((r) => ({
      ...r,
      metrics: (r.fee_template_metrics ?? []).slice().sort((a, b) => Number(a.display_order) - Number(b.display_order)),
    }));
  }

  private async getMetricExclusions(studentId: string, branchId: string): Promise<FeeMetricExclusionRow[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_metric_exclusions')
      .select('id, template_id, metric_id, excluded_by, reason, created_at')
      .eq('branch_id', branchId)
      .eq('student_id', studentId);
    throwIfDbError(error);
    return (data ?? []) as FeeMetricExclusionRow[];
  }

  async getStudentTemplates(
    studentId: string,
    branchId: string,
    month?: string,
  ): Promise<{ data: FeeStudentTemplatesResponseDto }> {
    const placement = await this.getStudentPlacement(studentId, branchId);
    const { inheritedTemplateIds, individualTemplateIds, autoApplyTemplateIds } =
      await this.resolveApplicableTemplateIds(studentId, placement, branchId);

    const allTemplateIds = Array.from(new Set([...inheritedTemplateIds, ...individualTemplateIds, ...autoApplyTemplateIds]));
    const [templates, exclusions] = await Promise.all([
      this.fetchTemplatesWithMetrics(allTemplateIds, branchId),
      this.getMetricExclusions(studentId, branchId),
    ]);

    const supabase = this.supabaseConfig.getClient();
    const { data: links, error: linkErr } = await supabase
      .from('fee_student_template_links')
      .select('id, template_id, start_date, end_date, is_active')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .eq('is_active', true);
    throwIfDbError(linkErr);

    const linkByTemplateId = new Map<string, { id: string; startDate: string | null; endDate: string | null }>();
    for (const l of (links ?? []) as Array<{ id: string; template_id: string; start_date: string | null; end_date: string | null }>) {
      linkByTemplateId.set(l.template_id, { id: l.id, startDate: l.start_date, endDate: l.end_date });
    }

    const excludedMetricIds = new Set(exclusions.map((e) => e.metric_id));
    const inheritedIdSet = new Set(inheritedTemplateIds);
    const individualIdSet = new Set(individualTemplateIds);
    const autoIdSet = new Set(autoApplyTemplateIds);
    const mappedTemplates: FeeStudentTemplateDto[] = templates.map((t) => {
      const metrics: FeeStudentTemplateMetricDto[] = t.metrics.map(
        (m) =>
          new FeeStudentTemplateMetricDto({
            id: m.id,
            name: m.name,
            amountType: m.amount_type,
            amount: Number(m.amount),
            perDay: !!m.per_day,
            displayOrder: Number(m.display_order) || 0,
            isExcluded: excludedMetricIds.has(m.id),
          }),
      );

      const source: 'Inherited' | 'Individual' | 'Auto' = autoIdSet.has(t.id)
        ? 'Auto'
        : individualIdSet.has(t.id)
          ? 'Individual'
          : inheritedIdSet.has(t.id)
            ? 'Inherited'
            : 'Inherited';
      const link = linkByTemplateId.get(t.id) ?? null;

      return new FeeStudentTemplateDto({
        id: t.id,
        name: t.name,
        type: t.type,
        scope: t.scope,
        proRateType: t.pro_rate_type,
        daysUntilDue: Number(t.days_until_due),
        autoApply: !!t.auto_apply,
        autoApplyCondition: t.auto_apply_condition,
        source,
        linkId: link?.id ?? null,
        linkStartDate: link?.startDate ?? null,
        linkEndDate: link?.endDate ?? null,
        metrics,
      });
    });

    const mappedExclusions = exclusions.map(
      (e) =>
        new FeeMetricExclusionDto({
          id: e.id,
          templateId: e.template_id,
          metricId: e.metric_id,
          reason: e.reason,
          excludedBy: e.excluded_by,
          createdAt: e.created_at,
        }),
    );

    const response = new FeeStudentTemplatesResponseDto({
      templates: mappedTemplates,
      exclusions: mappedExclusions,
    });

    if (month) {
      response.preview = await this.calculatePreview(studentId, branchId, month, {
        placement,
        templates,
        exclusions,
      });
    }

    return { data: response };
  }

  async getChallanPreview(
    studentId: string,
    branchId: string,
    input: FeeChallanPreviewDto,
  ): Promise<{ data: FeeCalculationPreviewDto }> {
    const month = (input.month ?? '').trim();
    if (!month) throw new BadRequestException('month is required');
    parseMonth(month); // validates YYYY-MM

    const preview = await this.calculatePreview(studentId, branchId, month, undefined, {
      includeIndividualTemplateIds: input.includeIndividualTemplateIds,
      metricEdits: input.metricEdits,
      templateEdits: input.templateEdits,
    });
    return { data: preview };
  }

  async calculatePreview(
    studentId: string,
    branchId: string,
    month: string,
    preloaded?: {
      placement: StudentPlacement;
      templates: Array<FeeTemplateRow & { metrics: FeeMetricRow[] }>;
      exclusions: FeeMetricExclusionRow[];
    },
    overrides?: PreviewOverrides,
  ): Promise<FeeCalculationPreviewDto> {
    const { year, monthIndex } = parseMonth(month);
    const dim = daysInMonth(year, monthIndex);

    const placement = preloaded?.placement ?? (await this.getStudentPlacement(studentId, branchId));
    const resolved = preloaded
      ? { inheritedTemplateIds: [], individualTemplateIds: [], autoApplyTemplateIds: [] }
      : await this.resolveApplicableTemplateIds(studentId, placement, branchId);
    const inheritedTemplateIds = overrides?.forcedInheritedTemplateId
      ? // Important: when bulk generation forces a specific inherited *Fee* template, we still want inherited Discounts
        // (assigned at Level/Class/Section) to remain additive. We'll fetch all inherited templates, but only
        // allow the forced template through the Fee calculation loop below.
        Array.from(new Set([overrides.forcedInheritedTemplateId, ...resolved.inheritedTemplateIds]))
      : resolved.inheritedTemplateIds;
    const individualTemplateIds = resolved.individualTemplateIds;
    const autoApplyTemplateIds = resolved.autoApplyTemplateIds;

    const templates =
      preloaded?.templates ??
      (await this.fetchTemplatesWithMetrics(
        Array.from(
          new Set([
            ...inheritedTemplateIds,
            ...individualTemplateIds,
            ...autoApplyTemplateIds,
            ...((overrides?.includeIndividualTemplateIds ?? []).map((x) => x.trim()).filter(Boolean)),
          ]),
        ),
        branchId,
      ));
    const exclusions = preloaded?.exclusions ?? (await this.getMetricExclusions(studentId, branchId));
    const excludedMetricIds = new Set(exclusions.map((e) => e.metric_id));

    const allowedFeeTemplateIds = (() => {
      // When forcing an inherited template (bulk modal), we should only apply that specific inherited Fee template,
      // plus any Individual/Auto fee templates that still apply to the student.
      if (!overrides?.forcedInheritedTemplateId) return null;
      return new Set<string>([
        overrides.forcedInheritedTemplateId,
        ...individualTemplateIds,
        ...autoApplyTemplateIds,
        ...((overrides?.includeIndividualTemplateIds ?? []).map((x) => x.trim()).filter(Boolean)),
      ]);
    })();

    const overrideExcludedTemplateIds = new Set<string>();
    for (const e of overrides?.templateEdits ?? []) {
      if (!e?.templateId) continue;
      if (e.action === 'exclude') overrideExcludedTemplateIds.add(e.templateId);
    }

    const overrideExcludedMetricIds = new Set<string>();
    const overrideAmountByMetricId = new Map<string, number>();
    for (const e of overrides?.metricEdits ?? []) {
      if (!e?.metricId) continue;
      if (overrideExcludedTemplateIds.has(e.templateId)) continue;
      if (e.action === 'exclude') {
        overrideExcludedMetricIds.add(e.metricId);
      } else if (e.action === 'overrideAmount') {
        if (typeof e.amount === 'number' && Number.isFinite(e.amount)) {
          overrideAmountByMetricId.set(e.metricId, e.amount);
        }
      }
    }

    // Pro-rate date window: if an Individual template link has dates, we apply those dates only to that template.
    const supabase = this.supabaseConfig.getClient();
    const { data: links, error: linkErr } = await supabase
      .from('fee_student_template_links')
      .select('template_id, start_date, end_date, is_active')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .eq('is_active', true);
    throwIfDbError(linkErr);

    const linkByTemplateId = new Map<string, { startDate?: string | null; endDate?: string | null }>();
    for (const l of (links ?? []) as StudentTemplateLinkRow[]) {
      linkByTemplateId.set(l.template_id, { startDate: l.start_date, endDate: l.end_date });
    }

    const items: FeeCalculationLineItemDto[] = [];
    let subtotal = 0;
    let baseForDiscountPercent = 0;

    // Fees first
    for (const t of templates.filter(
      (x) =>
        x.type === 'Fee' &&
        !overrideExcludedTemplateIds.has(x.id) &&
        (allowedFeeTemplateIds ? allowedFeeTemplateIds.has(x.id) : true),
    )) {
      const link = linkByTemplateId.get(t.id);
      const proRateType = t.pro_rate_type;
      let multiplier = 1;

      if (proRateType === 'Half_Month') multiplier = 0.5;

      if (proRateType === 'Daily_Pro_Rate') {
        // If link dates exist, compute enrolled days within that range; otherwise default full month.
        if (link?.startDate && link?.endDate) {
          const start = new Date(link.startDate);
          const end = new Date(link.endDate);
          if (end < start) throw new BadRequestException('Invalid pro-rate dates (end before start)');
          const days = daysInclusive(start, end);
          // Daily templates expect per_day metrics; still guard for non-per_day by dividing by days-in-month.
          multiplier = days; // applied per metric below
        } else {
          multiplier = dim;
        }
      }

      for (const m of t.metrics) {
        if (excludedMetricIds.has(m.id) || overrideExcludedMetricIds.has(m.id)) continue;
        if (m.amount_type === 'Percentage') {
          // A percentage fee metric is ambiguous without a base; disallow for now (design uses percentages for discounts / late fees).
          continue;
        }
        const overrideAmount = overrideAmountByMetricId.get(m.id);
        let amount = Number(overrideAmount ?? m.amount);
        if (proRateType === 'Half_Month') {
          amount = amount * 0.5;
        } else if (proRateType === 'Daily_Pro_Rate') {
          if (m.per_day) {
            amount = amount * multiplier;
          } else {
            amount = (amount / dim) * multiplier;
          }
        }
        amount = Math.round(amount * 100) / 100;
        subtotal += amount;
        baseForDiscountPercent += amount;
        items.push(
          new FeeCalculationLineItemDto({
            templateId: t.id,
            metricId: m.id,
            description: `${m.name} (${month})`,
            itemType: 'Fee',
            amount,
            isDiscount: false,
            displayOrder: Number(m.display_order) || 0,
          }),
        );
      }
    }

    // Discounts: multiplicative stacking on the base fees
    const discountPercents: number[] = [];
    const discountAbsolute: Array<{ templateId: string; metricId: string; name: string; amount: number; order: number }> = [];

    for (const t of templates.filter((x) => x.type === 'Discount' && !overrideExcludedTemplateIds.has(x.id))) {
      for (const m of t.metrics) {
        if (excludedMetricIds.has(m.id) || overrideExcludedMetricIds.has(m.id)) continue;
        const overrideAmount = overrideAmountByMetricId.get(m.id);
        const metricAmount = Number(overrideAmount ?? m.amount);
        if (m.amount_type === 'Percentage') {
          discountPercents.push(metricAmount);
          items.push(
            new FeeCalculationLineItemDto({
              templateId: t.id,
              metricId: m.id,
              description: `${m.name} (${Number(metricAmount)}%)`,
              itemType: 'Discount',
              amount: 0, // filled after stacking
              isDiscount: true,
              displayOrder: 1000 + (Number(m.display_order) || 0),
            }),
          );
        } else {
          discountAbsolute.push({
            templateId: t.id,
            metricId: m.id,
            name: m.name,
            amount: metricAmount,
            order: 1000 + (Number(m.display_order) || 0),
          });
        }
      }
    }

    let discounted = baseForDiscountPercent;
    for (const p of discountPercents) {
      discounted = discounted * (1 - p / 100);
    }
    discounted = Math.round(discounted * 100) / 100;
    const percentDiscountAmount = Math.max(0, baseForDiscountPercent - discounted);

    // Allocate percent discount amount across percent-discount items proportionally by percentage weight.
    const percentWeight = discountPercents.reduce((s, v) => s + Math.max(0, v), 0);
    if (percentDiscountAmount > 0 && percentWeight > 0) {
      let allocated = 0;
      let idx = 0;
      for (const it of items.filter((i) => i.itemType === 'Discount' && i.description.includes('%'))) {
        const p = discountPercents[idx] ?? 0;
        idx += 1;
        const portion = idx === discountPercents.length
          ? percentDiscountAmount - allocated
          : Math.round(((percentDiscountAmount * Math.max(0, p)) / percentWeight) * 100) / 100;
        allocated += portion;
        it.amount = -portion;
      }
    }

    for (const d of discountAbsolute) {
      items.push(
        new FeeCalculationLineItemDto({
          templateId: d.templateId,
          metricId: d.metricId,
          description: d.name,
          itemType: 'Discount',
          amount: -Math.round(d.amount * 100) / 100,
          isDiscount: true,
          displayOrder: d.order,
        }),
      );
    }

    const totalDiscount = Math.round(
      items.filter((i) => i.isDiscount).reduce((s, i) => s + Math.abs(i.amount), 0) * 100,
    ) / 100;

    const payableAmount = Math.max(
      0,
      Math.round((subtotal - totalDiscount) * 100) / 100,
    );

    items.sort((a, b) => a.displayOrder - b.displayOrder);

    return new FeeCalculationPreviewDto({
      month,
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount,
      lateFees: 0,
      payableAmount,
      items,
    });
  }
}

