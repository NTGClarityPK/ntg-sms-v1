import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
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
  is_active: boolean;
  sort_order: number;
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

function mapAssessmentType(row: AssessmentTypeRow): AssessmentTypeDto {
  return new AssessmentTypeDto({
    id: row.id,
    name: row.name,
    nameAr: row.name_ar ?? undefined,
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
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listAssessmentTypes(
    query: QueryAssessmentTypesDto,
    branchId: string,
  ): Promise<{ data: AssessmentTypeDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('assessment_types')
      .select('*', { count: 'exact' })
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
    return { data: ((data as AssessmentTypeRow[]) ?? []).map(mapAssessmentType), meta: { total, page, limit, totalPages } };
  }

  async createAssessmentType(
    input: { name: string; nameAr?: string; isActive?: boolean; sortOrder?: number },
    branchId: string,
    tenantId: string | null,
  ): Promise<AssessmentTypeDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('assessment_types')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);
    return mapAssessmentType(data as AssessmentTypeRow);
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

    const payload = input.ranges.map((r) => ({
      grade_template_id: templateRow.id,
      letter: r.letter,
      min_percentage: r.minPercentage,
      max_percentage: r.maxPercentage,
      sort_order: r.sortOrder,
    }));

    const { data: insertedRanges, error: rError } = await supabase.from('grade_ranges').insert(payload).select('*');
    throwIfDbError(rError);

    const ranges = ((insertedRanges as GradeRangeRow[]) ?? []).map(mapGradeRange).sort((a, b) => a.sortOrder - b.sortOrder);
    return mapGradeTemplate(templateRow, ranges);
  }

  async updateGradeTemplate(id: string, input: { name?: string; ranges?: Array<{ id?: string; letter: string; minPercentage: number; maxPercentage: number; sortOrder: number }> }): Promise<GradeTemplateDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing, error: eError } = await supabase.from('grade_templates').select('*').eq('id', id).single();
    if (eError || !existing) throw new NotFoundException('Grade template not found');

    const existingRow = existing as GradeTemplateRow;

    if (input.name && input.name.trim() !== existingRow.name) {
      const { error: uError } = await supabase.from('grade_templates').update({ name: input.name.trim() }).eq('id', id);
      throwIfDbError(uError);
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

  async deleteGradeTemplate(id: string): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    // Ensure template exists
    const { data: existing, error: eError } = await supabase.from('grade_templates').select('id').eq('id', id).maybeSingle();
    throwIfDbError(eError);
    if (!existing) {
      throw new NotFoundException('Grade template not found');
    }

    // Prevent deleting templates that are assigned to classes
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

    return { id };
  }

  async assignGradeTemplateToClass(input: { classId: string; gradeTemplateId: string; minimumPassingGrade: string }): Promise<{ data: ClassGradeAssignmentRow }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: template, error: tError } = await supabase.from('grade_templates').select('id').eq('id', input.gradeTemplateId).maybeSingle();
    throwIfDbError(tError);
    if (!template) throw new NotFoundException('Grade template not found');

    // Ensure passing grade exists in template
    const { data: letterRow, error: lError } = await supabase
      .from('grade_ranges')
      .select('id')
      .eq('grade_template_id', input.gradeTemplateId)
      .eq('letter', input.minimumPassingGrade)
      .maybeSingle();
    throwIfDbError(lError);
    if (!letterRow) throw new BadRequestException('minimumPassingGrade must exist in the template ranges');

    // Upsert by unique class_id
    const { data, error } = await supabase
      .from('class_grade_assignments')
      .upsert(
        {
          class_id: input.classId,
          grade_template_id: input.gradeTemplateId,
          minimum_passing_grade: input.minimumPassingGrade,
        },
        { onConflict: 'class_id' },
      )
      .select('*')
      .single();
    throwIfDbError(error);

    return { data: data as ClassGradeAssignmentRow };
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

  async setLeaveQuota(academicYearId: string, annualQuota: number): Promise<{ data: { academicYearId: string; annualQuota: number } }> {
    if (annualQuota < 0) throw new BadRequestException('annualQuota must be >= 0');

    const supabase = this.supabaseConfig.getClient();
    const { data: year, error: yError } = await supabase.from('academic_years').select('id').eq('id', academicYearId).maybeSingle();
    throwIfDbError(yError);
    if (!year) throw new NotFoundException('Academic year not found');

    const { error } = await supabase
      .from('leave_settings')
      .upsert({ academic_year_id: academicYearId, annual_quota: annualQuota }, { onConflict: 'academic_year_id' });
    throwIfDbError(error);

    return { data: { academicYearId, annualQuota } };
  }
}


