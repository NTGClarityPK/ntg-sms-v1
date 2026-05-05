import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { QueryAssessmentTypesDto } from './dto/query-assessment-types.dto';
import { AssessmentTypeDto } from './dto/assessment-type.dto';
import { GradeTemplateDto } from './dto/grade-template.dto';
import { GradeRangeDto } from './dto/grade-range.dto';

type Meta = { total: number; page: number; limit: number; totalPages: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type AssessmentTypeRow = {
  id: string;
  name: string;
  name_ar: string | null;
  name_translations?: Record<string, string> | null;
  is_active: boolean;
  sort_order: number;
  is_term_examination: boolean;
  created_at: string;
  updated_at: string;
};

type GradeTemplateRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type GradeRangeRow = {
  id: string;
  grade_template_id: string;
  letter: string;
  min_percentage: string | number;
  max_percentage: string | number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type LeaveSettingsRow = {
  id: string;
  annual_quota: number;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

type ClassGradeAssignmentRow = {
  id: string;
  class_id: string;
  grade_template_id: string;
  minimum_passing_grade: string;
  created_at: string;
  updated_at: string;
};

type ClassLiteRow = {
  id: string;
  display_name: string;
};

type GradeTemplateLiteRow = {
  id: string;
  name: string;
};

function resolveAssessmentTypeName(
  row: { name: string; name_translations?: Record<string, string> | null },
  language: string,
): string {
  const t = row.name_translations;
  return (t?.[language] ?? t?.en ?? row.name) || row.name;
}

function mapAssessmentType(row: AssessmentTypeRow, language: string = 'ar'): AssessmentTypeDto {
  const name = resolveAssessmentTypeName(row, language);
  return new AssessmentTypeDto({
    id: row.id,
    name,
    nameAr: row.name_ar ?? undefined,
    isTermExamination: row.is_term_examination,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function mapGradeRange(row: GradeRangeRow): GradeRangeDto {
  return new GradeRangeDto({
    id: row.id,
    letter: row.letter,
    minPercentage: toNumber(row.min_percentage),
    maxPercentage: toNumber(row.max_percentage),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapGradeTemplate(row: GradeTemplateRow, ranges: GradeRangeDto[]): GradeTemplateDto {
  return new GradeTemplateDto({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ranges,
  });
}

function validateRanges(ranges: Array<{ letter: string; minPercentage: number; maxPercentage: number; sortOrder: number }>): void {
  if (ranges.length === 0) throw new BadRequestException('At least one grade range is required');

  const normalized = ranges
    .map((r) => ({
      ...r,
      letter: r.letter.trim(),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const letters = new Set<string>();
  for (const r of normalized) {
    if (!r.letter) throw new BadRequestException('Grade letter is required');
    if (letters.has(r.letter)) throw new BadRequestException(`Duplicate grade letter: ${r.letter}`);
    letters.add(r.letter);
    if (r.minPercentage > r.maxPercentage) {
      throw new BadRequestException(`Invalid range for ${r.letter}: minPercentage must be <= maxPercentage`);
    }
  }

  // Basic overlap check (by numeric intervals). Sort by min then max.
  const byMin = [...normalized].sort((a, b) => a.minPercentage - b.minPercentage || a.maxPercentage - b.maxPercentage);
  for (let i = 1; i < byMin.length; i++) {
    const prev = byMin[i - 1];
    const cur = byMin[i];
    if (cur.minPercentage <= prev.maxPercentage) {
      throw new BadRequestException('Grade ranges must not overlap');
    }
  }
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listAssessmentTypes(
    query: QueryAssessmentTypesDto,
    branchId: string,
  ): Promise<{ data: AssessmentTypeDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const language = query.language ?? 'ar';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('assessment_types')
      .select(
        'id, name, name_ar, name_translations, is_active, is_term_examination, sort_order, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      dbQuery = dbQuery.ilike('name', `%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: ((data as AssessmentTypeRow[]) ?? []).map((row) => mapAssessmentType(row, language)),
      meta: { total, page, limit, totalPages },
    };
  }

  async createAssessmentType(
    input: {
      name: string;
      nameAr?: string;
      name_translations?: { en?: string; ar?: string };
      isActive?: boolean;
      sortOrder?: number;
      isTermExamination?: boolean;
    },
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<AssessmentTypeDto> {
    const supabase = this.supabaseConfig.getClient();
    const nameTranslations = input.name_translations ?? { en: input.name, ar: input.nameAr ?? input.name };
    const { data, error } = await supabase
      .from('assessment_types')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        name_translations: nameTranslations,
        is_active: input.isActive ?? true,
        is_term_examination: input.isTermExamination ?? false,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select(
        'id, name, name_ar, name_translations, is_active, is_term_examination, sort_order, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);
    const row = data as AssessmentTypeRow;
    this.auditLogService
      .logCreate('assessment_types', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});
    return mapAssessmentType(row, 'ar');
  }

  async updateAssessmentType(
    id: string,
    input: {
      name?: string;
      nameAr?: string;
      name_translations?: { en?: string; ar?: string };
      isActive?: boolean;
      sortOrder?: number;
      isTermExamination?: boolean;
    },
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<AssessmentTypeDto> {
    const supabase = this.supabaseConfig.getClient();
    const updates: Partial<AssessmentTypeRow> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.nameAr !== undefined) updates.name_ar = input.nameAr || null;
    if (input.name_translations !== undefined) updates.name_translations = input.name_translations;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
    if (input.isTermExamination !== undefined) updates.is_term_examination = input.isTermExamination;
    const { data: oldRow, error: fetchError } = await supabase
      .from('assessment_types')
      .select(
        'id, name, name_ar, name_translations, is_active, is_term_examination, sort_order, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Assessment type not found');
    if (Object.keys(updates).length === 0) {
      return mapAssessmentType(oldRow as AssessmentTypeRow, 'ar');
    }
    const { data, error } = await supabase
      .from('assessment_types')
      .update(updates)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, name, name_ar, name_translations, is_active, is_term_examination, sort_order, created_at, updated_at',
      )
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Assessment type not found');
    const changedFields = Object.keys(updates) as string[];
    this.auditLogService
      .logUpdate(
        'assessment_types',
        id,
        userEmail,
        oldRow as Record<string, unknown>,
        data as Record<string, unknown>,
        changedFields,
        { branchId, tenantId },
      )
      .catch(() => {});
    return mapAssessmentType(data as AssessmentTypeRow, 'ar');
  }

  async listGradeTemplates(branchId: string): Promise<{ data: GradeTemplateDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: templates, error: tError } = await supabase
      .from('grade_templates')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    throwIfDbError(tError);

    const templateRows = (templates as GradeTemplateRow[]) ?? [];
    const ids = templateRows.map((t) => t.id);

    let rangesByTemplate = new Map<string, GradeRangeDto[]>();
    if (ids.length > 0) {
      const { data: ranges, error: rError } = await supabase
        .from('grade_ranges')
        .select('*')
        .in('grade_template_id', ids)
        .order('sort_order', { ascending: true });
      throwIfDbError(rError);

      for (const r of (ranges as GradeRangeRow[]) ?? []) {
        const arr = rangesByTemplate.get(r.grade_template_id) ?? [];
        arr.push(mapGradeRange(r));
        rangesByTemplate.set(r.grade_template_id, arr);
      }
    }

    return { data: templateRows.map((t) => mapGradeTemplate(t, rangesByTemplate.get(t.id) ?? [])) };
  }

  async createGradeTemplate(
    input: { name: string; ranges: Array<{ letter: string; minPercentage: number; maxPercentage: number; sortOrder: number }> },
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<GradeTemplateDto> {
    validateRanges(input.ranges);

    const supabase = this.supabaseConfig.getClient();
    const { data: template, error: tError } = await supabase
      .from('grade_templates')
      .insert({ name: input.name, branch_id: branchId, tenant_id: tenantId })
      .select('*')
      .single();
    throwIfDbError(tError);

    const templateRow = template as GradeTemplateRow;
    this.auditLogService
      .logCreate('grade_templates', templateRow.id, userEmail, { ...templateRow } as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});

    const payload = input.ranges.map((r) => ({
      grade_template_id: templateRow.id,
      letter: r.letter,
      min_percentage: r.minPercentage,
      max_percentage: r.maxPercentage,
      sort_order: r.sortOrder,
    }));

    const { data: insertedRanges, error: rError } = await supabase.from('grade_ranges').insert(payload).select('*');
    throwIfDbError(rError);
    for (const r of (insertedRanges as GradeRangeRow[]) ?? []) {
      this.auditLogService
        .logCreate('grade_ranges', r.id, userEmail, { ...r } as Record<string, unknown>, {
          branchId,
          tenantId,
        })
        .catch(() => {});
    }

    const ranges = ((insertedRanges as GradeRangeRow[]) ?? []).map(mapGradeRange).sort((a, b) => a.sortOrder - b.sortOrder);
    return mapGradeTemplate(templateRow, ranges);
  }

  async updateGradeTemplate(
    id: string,
    input: { name?: string; ranges?: Array<{ id?: string; letter: string; minPercentage: number; maxPercentage: number; sortOrder: number }> },
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<GradeTemplateDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing, error: eError } = await supabase.from('grade_templates').select('*').eq('id', id).single();
    if (eError || !existing) throw new NotFoundException('Grade template not found');

    const existingRow = existing as GradeTemplateRow;

    if (input.name && input.name.trim() !== existingRow.name) {
      const { data: updated, error: uError } = await supabase
        .from('grade_templates')
        .update({ name: input.name.trim() })
        .eq('id', id)
        .select('*')
        .single();
      throwIfDbError(uError);
      if (updated) {
        this.auditLogService
          .logUpdate(
            'grade_templates',
            id,
            userEmail,
            existingRow as Record<string, unknown>,
            updated as Record<string, unknown>,
            ['name'],
            { branchId, tenantId },
          )
          .catch(() => {});
      }
    }

    if (input.ranges) {
      // Replace ranges entirely for simplicity/consistency.
      const normalized = input.ranges.map((r) => ({
        letter: r.letter,
        minPercentage: r.minPercentage,
        maxPercentage: r.maxPercentage,
        sortOrder: r.sortOrder,
      }));
      validateRanges(normalized);

      const { error: delError } = await supabase.from('grade_ranges').delete().eq('grade_template_id', id);
      throwIfDbError(delError);

      const payload = normalized.map((r) => ({
        grade_template_id: id,
        letter: r.letter,
        min_percentage: r.minPercentage,
        max_percentage: r.maxPercentage,
        sort_order: r.sortOrder,
      }));
      const { data: insertedRanges, error: insError } = await supabase.from('grade_ranges').insert(payload).select('*');
      throwIfDbError(insError);

      const ranges = ((insertedRanges as GradeRangeRow[]) ?? []).map(mapGradeRange).sort((a, b) => a.sortOrder - b.sortOrder);
      return mapGradeTemplate({ ...existingRow, name: input.name?.trim() ?? existingRow.name }, ranges);
    }

    // Re-fetch ranges to return full template
    const { data: ranges, error: rError } = await supabase
      .from('grade_ranges')
      .select('*')
      .eq('grade_template_id', id)
      .order('sort_order', { ascending: true });
    throwIfDbError(rError);

    return mapGradeTemplate({ ...existingRow, name: input.name?.trim() ?? existingRow.name }, ((ranges as GradeRangeRow[]) ?? []).map(mapGradeRange));
  }

  async deleteGradeTemplate(
    id: string,
    userEmail: string,
    branchId?: string,
    tenantId?: string | null,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow, error: eError } = await supabase.from('grade_templates').select('*').eq('id', id).maybeSingle();
    throwIfDbError(eError);
    if (!oldRow) {
      throw new NotFoundException('Grade template not found');
    }

    const { data: assignments, error: aError } = await supabase
      .from('class_grade_assignments')
      .select('id')
      .eq('grade_template_id', id)
      .limit(1);
    throwIfDbError(aError);

    if (assignments && assignments.length > 0) {
      throw new BadRequestException('Cannot delete a grade template that is assigned to classes');
    }

    const { error: delRangesError } = await supabase.from('grade_ranges').delete().eq('grade_template_id', id);
    throwIfDbError(delRangesError);

    const { error: delTemplateError } = await supabase.from('grade_templates').delete().eq('id', id);
    throwIfDbError(delTemplateError);

    this.auditLogService
      .logDelete('grade_templates', id, userEmail, oldRow as Record<string, unknown>, {
        branchId: branchId ?? null,
        tenantId: tenantId ?? null,
      })
      .catch(() => {});

    return { id };
  }

  async assignGradeTemplateToClass(input: {
    classIds: string[];
    gradeTemplateId: string;
    minimumPassingGrade: string;
  }): Promise<{ data: { assignedCount: number } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: template, error: tError } = await supabase
      .from('grade_templates')
      .select('id')
      .eq('id', input.gradeTemplateId)
      .maybeSingle();
    throwIfDbError(tError);
    if (!template) throw new NotFoundException('Grade template not found');

    const { data: letterRow, error: lError } = await supabase
      .from('grade_ranges')
      .select('id')
      .eq('grade_template_id', input.gradeTemplateId)
      .eq('letter', input.minimumPassingGrade)
      .maybeSingle();
    throwIfDbError(lError);
    if (!letterRow) throw new BadRequestException('minimumPassingGrade must exist in the template ranges');

    const uniqueClassIds = Array.from(new Set(input.classIds));
    if (uniqueClassIds.length === 0) {
      return { data: { assignedCount: 0 } };
    }

    const rows = uniqueClassIds.map((class_id) => ({
      class_id,
      grade_template_id: input.gradeTemplateId,
      minimum_passing_grade: input.minimumPassingGrade,
    }));

    const { error } = await supabase
      .from('class_grade_assignments')
      .upsert(rows, { onConflict: 'class_id' });
    throwIfDbError(error);

    return { data: { assignedCount: rows.length } };
  }

  async listClassGradeAssignments(branchId: string): Promise<{
    data: Array<{
      id: string;
      classId: string;
      className: string;
      gradeTemplateId: string;
      gradeTemplateName: string;
      minimumPassingGrade: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    // First, get all classes for this branch
    const { data: branchClasses, error: bcError } = await supabase
      .from('classes')
      .select('id')
      .eq('branch_id', branchId);
    throwIfDbError(bcError);

    const branchClassIds = ((branchClasses as { id: string }[]) ?? []).map(c => c.id);
    if (branchClassIds.length === 0) {
      return { data: [] };
    }

    // Now get assignments only for those classes
    const { data: assignments, error: aError } = await supabase
      .from('class_grade_assignments')
      .select('*')
      .in('class_id', branchClassIds);
    throwIfDbError(aError);

    const rows = (assignments as ClassGradeAssignmentRow[]) ?? [];
    if (rows.length === 0) {
      return { data: [] };
    }

    const classIds = Array.from(new Set(rows.map((r) => r.class_id)));
    const templateIds = Array.from(new Set(rows.map((r) => r.grade_template_id)));

    const { data: classes, error: cError } = await supabase
      .from('classes')
      .select('id,display_name')
      .in('id', classIds);
    throwIfDbError(cError);

    const { data: templates, error: tError } = await supabase
      .from('grade_templates')
      .select('id,name')
      .in('id', templateIds);
    throwIfDbError(tError);

    const classesById = new Map<string, ClassLiteRow>();
    for (const cls of (classes as ClassLiteRow[]) ?? []) {
      classesById.set(cls.id, cls);
    }

    const templatesById = new Map<string, GradeTemplateLiteRow>();
    for (const tpl of (templates as GradeTemplateLiteRow[]) ?? []) {
      templatesById.set(tpl.id, tpl);
    }

    return {
      data: rows.map((row) => {
        const cls = classesById.get(row.class_id);
        const tpl = templatesById.get(row.grade_template_id);
        return {
          id: row.id,
          classId: row.class_id,
          className: cls?.display_name ?? 'Unknown class',
          gradeTemplateId: row.grade_template_id,
          gradeTemplateName: tpl?.name ?? 'Unknown template',
          minimumPassingGrade: row.minimum_passing_grade,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
    };
  }

  async getLeaveQuota(academicYearId: string): Promise<{ data: { academicYearId: string; annualQuota: number } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('leave_settings')
      .select('*')
      .eq('academic_year_id', academicYearId)
      .maybeSingle();
    throwIfDbError(error);

    const row = data as LeaveSettingsRow | null;
    return { data: { academicYearId, annualQuota: row?.annual_quota ?? 0 } };
  }

  async setLeaveQuota(
    academicYearId: string,
    annualQuota: number,
    userEmail: string,
    branchId?: string | null,
    tenantId?: string | null,
  ): Promise<{ data: { academicYearId: string; annualQuota: number } }> {
    if (annualQuota < 0) throw new BadRequestException('annualQuota must be >= 0');

    const supabase = this.supabaseConfig.getClient();
    const { data: year, error: yError } = await supabase.from('academic_years').select('id').eq('id', academicYearId).maybeSingle();
    throwIfDbError(yError);
    if (!year) throw new NotFoundException('Academic year not found');

    const { data: oldRow } = await supabase
      .from('leave_settings')
      .select('*')
      .eq('academic_year_id', academicYearId)
      .maybeSingle();

    const { data: newRow, error } = await supabase
      .from('leave_settings')
      .upsert(
        { academic_year_id: academicYearId, annual_quota: annualQuota, updated_at: new Date().toISOString() },
        { onConflict: 'academic_year_id' },
      )
      .select('*')
      .single();
    throwIfDbError(error);

    if (newRow) {
      const recordId = (newRow as { id?: string; academic_year_id: string }).id ?? academicYearId;
      this.auditLogService
        .logUpdate(
          'leave_settings',
          recordId,
          userEmail,
          (oldRow ?? {}) as Record<string, unknown>,
          newRow as Record<string, unknown>,
          ['annual_quota'],
          { branchId: branchId ?? undefined, tenantId: tenantId ?? undefined },
        )
        .catch(() => {});
    }

    return { data: { academicYearId, annualQuota } };
  }
}


