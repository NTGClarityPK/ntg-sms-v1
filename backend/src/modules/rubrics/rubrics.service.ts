import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CreateAssessmentRubricDto } from './dto/create-assessment-rubric.dto';
import { CreateRubricPresetDto } from './dto/create-rubric-preset.dto';
import { UpdateAssessmentRubricDto } from './dto/update-assessment-rubric.dto';
import { UpdateRubricPresetDto } from './dto/update-rubric-preset.dto';
import {
  AssessmentRubricDto,
  AssessmentRubricWithScoresDto,
  RubricCategoryDto,
  StudentRubricScoreDto,
} from './dto/assessment-rubric.dto';
import {
  RubricPresetCategoryDto,
  RubricPresetDto,
} from './dto/rubric-preset.dto';
import { UpsertStudentRubricScoresDto } from './dto/upsert-student-rubric-scores.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type PresetRow = {
  id: string;
  preset_name: string;
  preset_code: string | null;
  description: string | null;
  is_global: boolean;
  is_active: boolean;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
};

type PresetCategoryRow = {
  id: string;
  preset_id: string;
  category_name: string;
  category_code: string | null;
  default_marks: number | string | null;
  sort_order: number;
  description: string | null;
};

type RubricRow = {
  id: string;
  assessment_id: string;
  branch_id: string;
  rubric_type: string;
  preset_id: string | null;
  total_marks: number | string;
  source: string;
  google_rubric_id: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  rubric_id: string;
  category_name: string;
  category_code: string | null;
  max_marks: number | string;
  sort_order: number;
  description: string | null;
  google_criterion_id: string | null;
};

type ScoreRow = {
  id: string;
  student_grade_id: string;
  rubric_category_id: string;
  marks_obtained: number | string | null;
  feedback: string | null;
  source: string;
  graded_at: string | null;
};

@Injectable()
export class RubricsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  private toNumber(value: string | number | null | undefined): number {
    if (value == null) return 0;
    return typeof value === 'number' ? value : Number(value);
  }

  private mapPreset(
    row: PresetRow,
    categories: PresetCategoryRow[],
  ): RubricPresetDto {
    return new RubricPresetDto({
      id: row.id,
      presetName: row.preset_name,
      presetCode: row.preset_code ?? undefined,
      description: row.description ?? undefined,
      isGlobal: row.is_global,
      isActive: row.is_active,
      branchId: row.branch_id ?? undefined,
      categories: categories
        .filter((c) => c.preset_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(
          (c) =>
            new RubricPresetCategoryDto({
              id: c.id,
              categoryName: c.category_name,
              categoryCode: c.category_code ?? undefined,
              defaultMarks:
                c.default_marks != null ? this.toNumber(c.default_marks) : undefined,
              sortOrder: c.sort_order,
              description: c.description ?? undefined,
            }),
        ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapCategory(row: CategoryRow): RubricCategoryDto {
    return new RubricCategoryDto({
      id: row.id,
      categoryName: row.category_name,
      categoryCode: row.category_code ?? undefined,
      maxMarks: this.toNumber(row.max_marks),
      sortOrder: row.sort_order,
      description: row.description ?? undefined,
      googleCriterionId: row.google_criterion_id ?? undefined,
    });
  }

  private mapRubric(row: RubricRow, categories: CategoryRow[]): AssessmentRubricDto {
    return new AssessmentRubricDto({
      id: row.id,
      assessmentId: row.assessment_id,
      branchId: row.branch_id,
      rubricType: row.rubric_type,
      presetId: row.preset_id ?? undefined,
      totalMarks: this.toNumber(row.total_marks),
      source: row.source,
      googleRubricId: row.google_rubric_id ?? undefined,
      categories: categories
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => this.mapCategory(c)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async listPresets(branchId: string): Promise<{ data: RubricPresetDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: presets, error } = await supabase
      .from('rubric_presets')
      .select(
        'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
      )
      .eq('is_active', true)
      .or(`is_global.eq.true,branch_id.eq.${branchId}`)
      .order('is_global', { ascending: false })
      .order('preset_name', { ascending: true });
    throwIfDbError(error);

    const rows = (presets || []) as PresetRow[];
    if (rows.length === 0) return { data: [] };

    // Prefer branch customisations over the matching global template (same base code / name).
    const branchNames = new Set(
      rows.filter((r) => !r.is_global && r.branch_id === branchId).map((r) => r.preset_name.toLowerCase()),
    );
    const branchBaseCodes = new Set(
      rows
        .filter((r) => !r.is_global && r.branch_id === branchId && r.preset_code)
        .map((r) => (r.preset_code || '').replace(/_branch$/i, '').toLowerCase()),
    );
    const visibleRows = rows.filter((r) => {
      if (!r.is_global) return true;
      if (branchNames.has(r.preset_name.toLowerCase())) return false;
      if (r.preset_code && branchBaseCodes.has(r.preset_code.toLowerCase())) return false;
      return true;
    });

    if (visibleRows.length === 0) return { data: [] };

    const ids = visibleRows.map((r) => r.id);
    const { data: cats, error: catsError } = await supabase
      .from('rubric_preset_categories')
      .select(
        'id, preset_id, category_name, category_code, default_marks, sort_order, description',
      )
      .in('preset_id', ids)
      .order('sort_order', { ascending: true });
    throwIfDbError(catsError);

    return {
      data: visibleRows.map((r) => this.mapPreset(r, (cats || []) as PresetCategoryRow[])),
    };
  }

  async createPreset(
    input: CreateRubricPresetDto,
    branchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<{ data: RubricPresetDto }> {
    const supabase = this.supabaseConfig.getClient();
    const code =
      input.presetCode?.trim() ||
      `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const { data: preset, error } = await supabase
      .from('rubric_presets')
      .insert({
        branch_id: branchId,
        tenant_id: tenantId,
        preset_name: input.presetName.trim(),
        preset_code: code,
        description: input.description?.trim() || null,
        is_global: false,
        is_active: true,
        created_by: userId,
      })
      .select(
        'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);
    if (!preset) throw new BadRequestException('Failed to create rubric preset');

    const presetRow = preset as PresetRow;
    const categoryRows = input.categories.map((c, idx) => ({
      preset_id: presetRow.id,
      category_name: c.categoryName.trim(),
      category_code: c.categoryCode?.trim() || null,
      default_marks: c.defaultMarks ?? null,
      sort_order: c.sortOrder ?? idx,
      description: c.description?.trim() || null,
    }));

    const { data: cats, error: catsError } = await supabase
      .from('rubric_preset_categories')
      .insert(categoryRows)
      .select(
        'id, preset_id, category_name, category_code, default_marks, sort_order, description',
      );
    throwIfDbError(catsError);

    return {
      data: this.mapPreset(presetRow, (cats || []) as PresetCategoryRow[]),
    };
  }

  /**
   * Update a branch preset's categories (default marks, names, etc.).
   * Global presets are never mutated — a branch-specific copy is created/updated instead.
   */
  async updatePreset(
    presetId: string,
    input: UpdateRubricPresetDto,
    branchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<{ data: RubricPresetDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existingRaw, error: existingError } = await supabase
      .from('rubric_presets')
      .select(
        'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
      )
      .eq('id', presetId)
      .eq('is_active', true)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!existingRaw) throw new NotFoundException('Rubric preset not found');

    const existing = existingRaw as PresetRow;
    if (!existing.is_global && existing.branch_id && existing.branch_id !== branchId) {
      throw new ForbiddenException('Cannot edit a preset from another branch');
    }

    let targetId = existing.id;
    let targetRow = existing;

    if (existing.is_global) {
      const cloneCode = `${existing.preset_code || 'preset'}_branch`;
      const { data: cloneRaw, error: cloneError } = await supabase
        .from('rubric_presets')
        .select(
          'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
        )
        .eq('branch_id', branchId)
        .eq('preset_code', cloneCode)
        .eq('is_active', true)
        .maybeSingle();
      throwIfDbError(cloneError);

      if (cloneRaw) {
        targetRow = cloneRaw as PresetRow;
        targetId = targetRow.id;
        if (input.presetName?.trim() || input.description !== undefined) {
          const { data: updatedClone, error: updErr } = await supabase
            .from('rubric_presets')
            .update({
              preset_name: input.presetName?.trim() || targetRow.preset_name,
              description:
                input.description !== undefined
                  ? input.description?.trim() || null
                  : targetRow.description ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetId)
            .eq('branch_id', branchId)
            .select(
              'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
            )
            .single();
          throwIfDbError(updErr);
          targetRow = updatedClone as PresetRow;
        }
      } else {
        const { data: created, error: createErr } = await supabase
          .from('rubric_presets')
          .insert({
            branch_id: branchId,
            tenant_id: tenantId,
            preset_name: (input.presetName?.trim() || existing.preset_name).trim(),
            preset_code: cloneCode,
            description:
              input.description !== undefined
                ? input.description?.trim() || null
                : existing.description ?? null,
            is_global: false,
            is_active: true,
            created_by: userId,
          })
          .select(
            'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
          )
          .single();
        throwIfDbError(createErr);
        if (!created) throw new BadRequestException('Failed to customise rubric preset');
        targetRow = created as PresetRow;
        targetId = targetRow.id;
      }
    } else {
      if (input.presetName?.trim() || input.description !== undefined) {
        const { data: updated, error: updErr } = await supabase
          .from('rubric_presets')
          .update({
            preset_name: input.presetName?.trim() || existing.preset_name,
            description:
              input.description !== undefined
                ? input.description?.trim() || null
                : existing.description ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
          .eq('branch_id', branchId)
          .select(
            'id, preset_name, preset_code, description, is_global, is_active, branch_id, created_at, updated_at',
          )
          .single();
        throwIfDbError(updErr);
        targetRow = updated as PresetRow;
      }
    }

    const { error: delCatsError } = await supabase
      .from('rubric_preset_categories')
      .delete()
      .eq('preset_id', targetId);
    throwIfDbError(delCatsError);

    const categoryRows = input.categories.map((c, idx) => ({
      preset_id: targetId,
      category_name: c.categoryName.trim(),
      category_code: c.categoryCode?.trim() || null,
      default_marks: c.defaultMarks ?? null,
      sort_order: c.sortOrder ?? idx,
      description: c.description?.trim() || null,
    }));

    const { data: cats, error: catsError } = await supabase
      .from('rubric_preset_categories')
      .insert(categoryRows)
      .select(
        'id, preset_id, category_name, category_code, default_marks, sort_order, description',
      );
    throwIfDbError(catsError);

    return {
      data: this.mapPreset(targetRow, (cats || []) as PresetCategoryRow[]),
    };
  }

  async getAssessmentRubric(
    assessmentId: string,
    branchId: string,
  ): Promise<{ data: AssessmentRubricDto | null }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: rubric, error } = await supabase
      .from('assessment_rubrics')
      .select(
        'id, assessment_id, branch_id, rubric_type, preset_id, total_marks, source, google_rubric_id, created_at, updated_at',
      )
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!rubric) return { data: null };

    const rubricRow = rubric as RubricRow;
    const { data: cats, error: catsError } = await supabase
      .from('rubric_categories')
      .select(
        'id, rubric_id, category_name, category_code, max_marks, sort_order, description, google_criterion_id',
      )
      .eq('rubric_id', rubricRow.id)
      .order('sort_order', { ascending: true });
    throwIfDbError(catsError);

    return {
      data: this.mapRubric(rubricRow, (cats || []) as CategoryRow[]),
    };
  }

  async createAssessmentRubric(
    assessmentId: string,
    input: CreateAssessmentRubricDto,
    branchId: string,
    tenantId: string | null,
    userId: string,
  ): Promise<{ data: AssessmentRubricDto }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: assessment, error: aError } = await supabase
      .from('assessments')
      .select('id, total_marks')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(aError);
    if (!assessment) throw new NotFoundException('Assessment not found');

    const { data: existing } = await supabase
      .from('assessment_rubrics')
      .select('id')
      .eq('assessment_id', assessmentId)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException('Assessment already has a rubric');
    }

    let categories = input.categories;
    let rubricType = input.rubricType || 'custom';
    let presetId = input.presetId ?? null;

    if (input.presetId) {
      const { data: presetCats, error: pcError } = await supabase
        .from('rubric_preset_categories')
        .select(
          'category_name, category_code, default_marks, sort_order, description',
        )
        .eq('preset_id', input.presetId)
        .order('sort_order', { ascending: true });
      throwIfDbError(pcError);
      if (!presetCats || presetCats.length === 0) {
        throw new BadRequestException('Preset has no categories');
      }
      const { data: preset } = await supabase
        .from('rubric_presets')
        .select('preset_code')
        .eq('id', input.presetId)
        .maybeSingle();
      if ((preset as { preset_code?: string } | null)?.preset_code === 'ontario_ktac') {
        rubricType = 'ktac';
      } else {
        rubricType = 'preset_named';
      }
      categories = (
        presetCats as Array<{
          category_name: string;
          category_code: string | null;
          default_marks: number | string | null;
          sort_order: number;
          description: string | null;
        }>
      ).map((c) => ({
        categoryName: c.category_name,
        categoryCode: c.category_code ?? undefined,
        maxMarks: this.toNumber(c.default_marks) || 0,
        sortOrder: c.sort_order,
        description: c.description ?? undefined,
      }));
    }

    if (!categories || categories.length === 0) {
      throw new BadRequestException('At least one category is required');
    }

    const totalMarks = categories.reduce((sum, c) => sum + Number(c.maxMarks), 0);

    const { data: rubric, error } = await supabase
      .from('assessment_rubrics')
      .insert({
        assessment_id: assessmentId,
        branch_id: branchId,
        tenant_id: tenantId,
        rubric_type: rubricType,
        preset_id: presetId,
        total_marks: totalMarks,
        source: 'alma',
        created_by: userId,
      })
      .select(
        'id, assessment_id, branch_id, rubric_type, preset_id, total_marks, source, google_rubric_id, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);
    if (!rubric) throw new BadRequestException('Failed to create rubric');

    const rubricRow = rubric as RubricRow;
    const { data: cats, error: catsError } = await supabase
      .from('rubric_categories')
      .insert(
        categories.map((c, idx) => ({
          rubric_id: rubricRow.id,
          category_name: c.categoryName.trim(),
          category_code: c.categoryCode?.trim() || null,
          max_marks: c.maxMarks,
          sort_order: c.sortOrder ?? idx,
          description: c.description?.trim() || null,
        })),
      )
      .select(
        'id, rubric_id, category_name, category_code, max_marks, sort_order, description, google_criterion_id',
      );
    throwIfDbError(catsError);

    // Do not overwrite assessments.total_marks — that is the teacher-defined assessment total.
    // Rubric categories keep their own totals on assessment_rubrics.total_marks.
    await supabase
      .from('assessments')
      .update({ has_rubric: true })
      .eq('id', assessmentId)
      .eq('branch_id', branchId);

    return {
      data: this.mapRubric(rubricRow, (cats || []) as CategoryRow[]),
    };
  }

  /**
   * Override categories (marks/names) for an assessment rubric without deleting student scores
   * on categories that keep their ids.
   */
  async updateAssessmentRubric(
    assessmentId: string,
    input: UpdateAssessmentRubricDto,
    branchId: string,
  ): Promise<{ data: AssessmentRubricDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existingRubric } = await this.getAssessmentRubric(assessmentId, branchId);
    if (!existingRubric) throw new NotFoundException('Rubric not found');

    const existingIds = new Set(existingRubric.categories.map((c) => c.id));
    const keptIds = new Set(
      input.categories.map((c) => c.id).filter((id): id is string => !!id && existingIds.has(id)),
    );
    const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

    if (removedIds.length > 0) {
      const { count, error: scoreError } = await supabase
        .from('student_rubric_scores')
        .select('id', { count: 'exact', head: true })
        .in('rubric_category_id', removedIds);
      throwIfDbError(scoreError);
      if ((count ?? 0) > 0) {
        throw new BadRequestException(
          'Cannot remove a rubric category that already has student scores',
        );
      }
      const { error: delError } = await supabase
        .from('rubric_categories')
        .delete()
        .in('id', removedIds)
        .eq('rubric_id', existingRubric.id);
      throwIfDbError(delError);
    }

    const now = new Date().toISOString();
    for (let idx = 0; idx < input.categories.length; idx += 1) {
      const c = input.categories[idx];
      if (c.id && keptIds.has(c.id)) {
        const { error: updError } = await supabase
          .from('rubric_categories')
          .update({
            category_name: c.categoryName.trim(),
            category_code: c.categoryCode?.trim() || null,
            max_marks: c.maxMarks,
            sort_order: c.sortOrder ?? idx,
            description: c.description?.trim() || null,
          })
          .eq('id', c.id)
          .eq('rubric_id', existingRubric.id);
        throwIfDbError(updError);
      } else {
        const { error: insError } = await supabase.from('rubric_categories').insert({
          rubric_id: existingRubric.id,
          category_name: c.categoryName.trim(),
          category_code: c.categoryCode?.trim() || null,
          max_marks: c.maxMarks,
          sort_order: c.sortOrder ?? idx,
          description: c.description?.trim() || null,
        });
        throwIfDbError(insError);
      }
    }

    const totalMarks = input.categories.reduce((sum, c) => sum + Number(c.maxMarks), 0);
    const { error: rubricUpdError } = await supabase
      .from('assessment_rubrics')
      .update({ total_marks: totalMarks, updated_at: now })
      .eq('id', existingRubric.id)
      .eq('branch_id', branchId);
    throwIfDbError(rubricUpdError);

    const refreshed = await this.getAssessmentRubric(assessmentId, branchId);
    if (!refreshed.data) throw new BadRequestException('Failed to update rubric');
    return { data: refreshed.data };
  }

  async deleteAssessmentRubric(
    assessmentId: string,
    branchId: string,
  ): Promise<{ data: { success: boolean } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: rubric, error } = await supabase
      .from('assessment_rubrics')
      .select('id')
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!rubric) throw new NotFoundException('Rubric not found');

    const { data: cats } = await supabase
      .from('rubric_categories')
      .select('id')
      .eq('rubric_id', (rubric as { id: string }).id);
    const catIds = ((cats || []) as Array<{ id: string }>).map((c) => c.id);
    if (catIds.length > 0) {
      const { count, error: scoreError } = await supabase
        .from('student_rubric_scores')
        .select('id', { count: 'exact', head: true })
        .in('rubric_category_id', catIds);
      throwIfDbError(scoreError);
      if ((count ?? 0) > 0) {
        throw new BadRequestException('Cannot delete rubric while student scores exist');
      }
    }

    const { error: delError } = await supabase
      .from('assessment_rubrics')
      .delete()
      .eq('id', (rubric as { id: string }).id)
      .eq('branch_id', branchId);
    throwIfDbError(delError);

    await supabase
      .from('assessments')
      .update({ has_rubric: false })
      .eq('id', assessmentId)
      .eq('branch_id', branchId);

    return { data: { success: true } };
  }

  async getAssessmentRubricWithScores(
    assessmentId: string,
    branchId: string,
  ): Promise<{ data: AssessmentRubricWithScoresDto | null }> {
    const { data: rubric } = await this.getAssessmentRubric(assessmentId, branchId);
    if (!rubric) return { data: null };

    const supabase = this.supabaseConfig.getClient();
    const { data: grades, error: gError } = await supabase
      .from('student_grades')
      .select('id')
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId);
    throwIfDbError(gError);
    const gradeIds = ((grades || []) as Array<{ id: string }>).map((g) => g.id);
    if (gradeIds.length === 0) {
      return { data: new AssessmentRubricWithScoresDto({ rubric, scores: [] }) };
    }

    const categoryIds = rubric.categories.map((c) => c.id);
    const { data: scores, error: sError } = await supabase
      .from('student_rubric_scores')
      .select(
        'id, student_grade_id, rubric_category_id, marks_obtained, feedback, source, graded_at',
      )
      .in('student_grade_id', gradeIds)
      .eq('branch_id', branchId);
    throwIfDbError(sError);

    const catMap = new Map(rubric.categories.map((c) => [c.id, c]));
    const mapped = ((scores || []) as ScoreRow[])
      .filter((s) => categoryIds.includes(s.rubric_category_id))
      .map((s) => {
        const cat = catMap.get(s.rubric_category_id);
        return new StudentRubricScoreDto({
          id: s.id,
          studentGradeId: s.student_grade_id,
          rubricCategoryId: s.rubric_category_id,
          categoryName: cat?.categoryName,
          categoryCode: cat?.categoryCode,
          maxMarks: cat?.maxMarks,
          marksObtained:
            s.marks_obtained != null ? this.toNumber(s.marks_obtained) : undefined,
          feedback: s.feedback ?? undefined,
          source: s.source,
          gradedAt: s.graded_at ?? undefined,
        });
      });

    return {
      data: new AssessmentRubricWithScoresDto({ rubric, scores: mapped }),
    };
  }

  async upsertStudentRubricScores(
    studentGradeId: string,
    input: UpsertStudentRubricScoresDto,
    branchId: string,
    userId: string,
  ): Promise<{ data: StudentRubricScoreDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: grade, error: gError } = await supabase
      .from('student_grades')
      .select('id, assessment_id')
      .eq('id', studentGradeId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(gError);
    if (!grade) throw new NotFoundException('Student grade not found');

    const assessmentId = (grade as { assessment_id: string }).assessment_id;
    const { data: rubric } = await this.getAssessmentRubric(assessmentId, branchId);
    if (!rubric) throw new BadRequestException('Assessment has no rubric');

    const catMap = new Map(rubric.categories.map((c) => [c.id, c]));
    let total = 0;
    const now = new Date().toISOString();
    const results: StudentRubricScoreDto[] = [];

    for (const item of input.scores) {
      const cat = catMap.get(item.categoryId);
      if (!cat) {
        throw new BadRequestException(`Unknown rubric category: ${item.categoryId}`);
      }
      if (item.marksObtained > cat.maxMarks) {
        throw new BadRequestException(
          `Marks for ${cat.categoryName} cannot exceed ${cat.maxMarks}`,
        );
      }
      total += item.marksObtained;

      const { data: upserted, error } = await supabase
        .from('student_rubric_scores')
        .upsert(
          {
            student_grade_id: studentGradeId,
            rubric_category_id: item.categoryId,
            marks_obtained: item.marksObtained,
            feedback: item.feedback?.trim() || null,
            branch_id: branchId,
            graded_by: userId,
            graded_at: now,
            source: 'manual',
          },
          { onConflict: 'student_grade_id,rubric_category_id' },
        )
        .select(
          'id, student_grade_id, rubric_category_id, marks_obtained, feedback, source, graded_at',
        )
        .single();
      throwIfDbError(error);
      const row = upserted as ScoreRow;
      results.push(
        new StudentRubricScoreDto({
          id: row.id,
          studentGradeId: row.student_grade_id,
          rubricCategoryId: row.rubric_category_id,
          categoryName: cat.categoryName,
          categoryCode: cat.categoryCode,
          maxMarks: cat.maxMarks,
          marksObtained: this.toNumber(row.marks_obtained),
          feedback: row.feedback ?? undefined,
          source: row.source,
          gradedAt: row.graded_at ?? undefined,
        }),
      );
    }

    await supabase
      .from('student_grades')
      .update({
        marks_obtained: total,
        graded_by: userId,
        graded_at: now,
        submission_status: 'submitted',
      })
      .eq('id', studentGradeId)
      .eq('branch_id', branchId);

    return { data: results };
  }

  /**
   * Used by Google Classroom import: create rubric from external criteria.
   */
  async importGoogleRubric(
    assessmentId: string,
    branchId: string,
    tenantId: string | null,
    userId: string,
    googleRubricId: string | null,
    criteria: Array<{
      id: string;
      title: string;
      description?: string;
      maxPoints: number;
    }>,
  ): Promise<AssessmentRubricDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing } = await this.getAssessmentRubric(assessmentId, branchId);
    if (existing) {
      await this.deleteAssessmentRubric(assessmentId, branchId);
    }

    const totalMarks = criteria.reduce((s, c) => s + c.maxPoints, 0);
    const { data: rubric, error } = await supabase
      .from('assessment_rubrics')
      .insert({
        assessment_id: assessmentId,
        branch_id: branchId,
        tenant_id: tenantId,
        rubric_type: 'custom',
        total_marks: totalMarks,
        source: 'google_classroom',
        google_rubric_id: googleRubricId,
        created_by: userId,
      })
      .select(
        'id, assessment_id, branch_id, rubric_type, preset_id, total_marks, source, google_rubric_id, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);
    if (!rubric) throw new BadRequestException('Failed to import Google rubric');

    const rubricRow = rubric as RubricRow;
    const { data: cats, error: catsError } = await supabase
      .from('rubric_categories')
      .insert(
        criteria.map((c, idx) => ({
          rubric_id: rubricRow.id,
          category_name: c.title,
          max_marks: c.maxPoints,
          sort_order: idx,
          description: c.description || null,
          google_criterion_id: c.id,
        })),
      )
      .select(
        'id, rubric_id, category_name, category_code, max_marks, sort_order, description, google_criterion_id',
      );
    throwIfDbError(catsError);

    // Keep teacher-defined assessment total_marks; only flag that a rubric exists.
    await supabase
      .from('assessments')
      .update({ has_rubric: true })
      .eq('id', assessmentId)
      .eq('branch_id', branchId);

    return this.mapRubric(rubricRow, (cats || []) as CategoryRow[]);
  }
}
