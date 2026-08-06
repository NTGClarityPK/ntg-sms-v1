import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { StudentPlacementService } from '../../common/services/student-placement.service';
import {
  CreateBlankFrameworkPresetDto,
  CreateFrameworkCategoryDto,
  UpdateBranchBehavioralConfigDto,
  UpdateFrameworkCategoryDto,
  UpdateFrameworkPresetDto,
} from './dto/preset.dto';
import {
  CreateFrameworkRatingDto,
  FrameworkCategoryScoreItemDto,
  UpdateFrameworkRatingDto,
} from './dto/rating.dto';
import {
  BranchBehavioralConfigDto,
  ClassFrameworkReportDto,
  ClassFrameworkReportStudentDto,
  CombinedBehavioralHistoryDto,
  CombinedHistoryEntryDto,
  FrameworkCategoryDto,
  FrameworkCategoryScoreDto,
  FrameworkHistoryEntryDto,
  FrameworkPresetDto,
  FrameworkRatingDto,
  RatingScaleLevelResponseDto,
  StarHistoryEntryDto,
  StarHistoryScoreDto,
} from './dto/response.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type RatingScaleLevel = {
  code: string;
  label: string;
  order: number;
  color?: string;
};

type PresetRow = {
  id: string;
  branch_id: string | null;
  preset_code: string | null;
  preset_name: string;
  description: string | null;
  is_global: boolean;
  default_rating_scale: unknown;
  comments_required: boolean;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  preset_id: string;
  category_name: string;
  description: string | null;
  sort_order: number;
  indicators: unknown;
  created_at: string;
  updated_at: string;
};

type ConfigRow = {
  id: string;
  branch_id: string;
  active_system: 'star_based' | 'framework_based';
  framework_preset_id: string | null;
  switched_at: string | null;
  switched_by: string | null;
  created_at: string;
  updated_at: string;
};

type RatingRow = {
  id: string;
  student_id: string;
  branch_id: string;
  academic_year_id: string;
  preset_id: string;
  rating_period: string;
  period_label: string;
  assessment_month: string;
  rated_by: string;
  rated_at: string;
  created_at: string;
  updated_at: string;
};

type ScoreRow = {
  id: string;
  rating_id: string;
  category_id: string;
  category_name: string;
  rating_code: string;
  teacher_comment: string | null;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

const PRESET_SELECT =
  'id, branch_id, preset_code, preset_name, description, is_global, default_rating_scale, comments_required, created_at, updated_at';
const CATEGORY_SELECT =
  'id, preset_id, category_name, description, sort_order, indicators, created_at, updated_at';
const RATING_SELECT =
  'id, student_id, branch_id, academic_year_id, preset_id, rating_period, period_label, assessment_month, rated_by, rated_at, created_at, updated_at';
const SCORE_SELECT =
  'id, rating_id, category_id, category_name, rating_code, teacher_comment, branch_id, created_at, updated_at';

const DEFAULT_BLANK_SCALE: RatingScaleLevel[] = [
  { code: 'E', label: 'Excellent', order: 1 },
  { code: 'G', label: 'Good', order: 2 },
  { code: 'S', label: 'Satisfactory', order: 3 },
  { code: 'N', label: 'Needs Improvement', order: 4 },
];

function firstDayOfMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function normalizeAssessmentMonth(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = trimmed.slice(0, 10);
    return `${d.slice(0, 7)}-01`;
  }
  throw new BadRequestException('assessmentMonth must be YYYY-MM or YYYY-MM-DD');
}

function periodLabelFromMonth(assessmentMonth: string): string {
  const [y, m] = assessmentMonth.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function parseScale(raw: unknown): RatingScaleLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const code = String(o.code ?? '').trim();
      const label = String(o.label ?? '').trim();
      const order = typeof o.order === 'number' ? o.order : Number(o.order ?? 0);
      if (!code || !label) return null;
      const level: RatingScaleLevel = { code, label, order: Number.isFinite(order) ? order : 0 };
      if (typeof o.color === 'string' && o.color.trim()) level.color = o.color.trim();
      return level;
    })
    .filter((x): x is RatingScaleLevel => x != null)
    .sort((a, b) => a.order - b.order);
}

function parseIndicators(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter((x) => x.length > 0);
}

@Injectable()
export class BehavioralFrameworkService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly studentPlacementService: StudentPlacementService,
  ) {}

  private mapScale(levels: RatingScaleLevel[]): RatingScaleLevelResponseDto[] {
    return levels.map(
      (l) =>
        new RatingScaleLevelResponseDto({
          code: l.code,
          label: l.label,
          order: l.order,
          color: l.color,
        }),
    );
  }

  private mapCategory(row: CategoryRow): FrameworkCategoryDto {
    return new FrameworkCategoryDto({
      id: row.id,
      categoryName: row.category_name,
      description: row.description ?? undefined,
      sortOrder: row.sort_order,
      indicators: parseIndicators(row.indicators),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapPreset(row: PresetRow, categories: CategoryRow[]): FrameworkPresetDto {
    return new FrameworkPresetDto({
      id: row.id,
      presetName: row.preset_name,
      presetCode: row.preset_code ?? undefined,
      description: row.description ?? undefined,
      isGlobal: row.is_global,
      branchId: row.branch_id ?? undefined,
      defaultRatingScale: this.mapScale(parseScale(row.default_rating_scale)),
      commentsRequired: row.comments_required,
      categories: categories
        .filter((c) => c.preset_id === row.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => this.mapCategory(c)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapScore(row: ScoreRow): FrameworkCategoryScoreDto {
    return new FrameworkCategoryScoreDto({
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      ratingCode: row.rating_code,
      teacherComment: row.teacher_comment ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapRating(row: RatingRow, scores: ScoreRow[]): FrameworkRatingDto {
    return new FrameworkRatingDto({
      id: row.id,
      studentId: row.student_id,
      branchId: row.branch_id,
      academicYearId: row.academic_year_id,
      presetId: row.preset_id,
      ratingPeriod: row.rating_period,
      periodLabel: row.period_label,
      assessmentMonth: row.assessment_month,
      ratedBy: row.rated_by,
      ratedAt: row.rated_at,
      categoryScores: scores.map((s) => this.mapScore(s)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private async loadCategoriesForPresets(
    presetIds: string[],
  ): Promise<Map<string, CategoryRow[]>> {
    const map = new Map<string, CategoryRow[]>();
    if (presetIds.length === 0) return map;
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('behavioral_framework_categories')
      .select(CATEGORY_SELECT)
      .in('preset_id', presetIds)
      .order('sort_order', { ascending: true });
    throwIfDbError(error);
    for (const row of (data || []) as CategoryRow[]) {
      const list = map.get(row.preset_id) || [];
      list.push(row);
      map.set(row.preset_id, list);
    }
    return map;
  }

  private async getPresetRow(presetId: string): Promise<PresetRow> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('behavioral_framework_presets')
      .select(PRESET_SELECT)
      .eq('id', presetId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Framework preset not found');
    return data as PresetRow;
  }

  private async assertBranchOwnedPreset(
    preset: PresetRow,
    branchId: string,
  ): Promise<void> {
    if (preset.is_global || preset.branch_id !== branchId) {
      throw new ForbiddenException('Only branch-owned presets can be modified');
    }
  }

  async getConfig(branchId: string): Promise<{ data: BranchBehavioralConfigDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branch_behavioral_config')
      .select(
        'id, branch_id, active_system, framework_preset_id, switched_at, switched_by, created_at, updated_at',
      )
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);

    if (!data) {
      return {
        data: new BranchBehavioralConfigDto({
          branchId,
          activeSystem: 'star_based',
        }),
      };
    }

    const row = data as ConfigRow;
    let frameworkPreset: FrameworkPresetDto | undefined;
    if (row.framework_preset_id) {
      const preset = await this.getPresetRow(row.framework_preset_id);
      const cats = await this.loadCategoriesForPresets([preset.id]);
      frameworkPreset = this.mapPreset(preset, cats.get(preset.id) || []);
    }

    return {
      data: new BranchBehavioralConfigDto({
        id: row.id,
        branchId: row.branch_id,
        activeSystem: row.active_system,
        frameworkPresetId: row.framework_preset_id ?? undefined,
        frameworkPreset,
        switchedAt: row.switched_at ?? undefined,
        switchedBy: row.switched_by ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    };
  }

  async updateConfig(
    branchId: string,
    userId: string,
    dto: UpdateBranchBehavioralConfigDto,
  ): Promise<{ data: BranchBehavioralConfigDto }> {
    const supabase = this.supabaseConfig.getClient();

    const current = await this.getConfig(branchId);
    let frameworkPresetId: string | null =
      current.data.frameworkPresetId ?? null;

    if (dto.activeSystem === 'framework_based') {
      const presetId = dto.frameworkPresetId ?? frameworkPresetId;
      if (!presetId) {
        throw new BadRequestException(
          'frameworkPresetId is required when switching to framework_based',
        );
      }
      const preset = await this.getPresetRow(presetId);
      await this.assertBranchOwnedPreset(preset, branchId);
      const cats = await this.loadCategoriesForPresets([preset.id]);
      if ((cats.get(preset.id) || []).length === 0) {
        throw new BadRequestException(
          'Active framework preset must have at least one category',
        );
      }
      frameworkPresetId = preset.id;
    } else if (dto.frameworkPresetId) {
      // Allow updating the stored preset while remaining on star_based
      const preset = await this.getPresetRow(dto.frameworkPresetId);
      await this.assertBranchOwnedPreset(preset, branchId);
      frameworkPresetId = preset.id;
    }

    const payload = {
      branch_id: branchId,
      active_system: dto.activeSystem,
      framework_preset_id: frameworkPresetId,
      switched_at: new Date().toISOString(),
      switched_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('branch_behavioral_config')
      .upsert(payload, { onConflict: 'branch_id' });
    throwIfDbError(error);

    return this.getConfig(branchId);
  }

  async listPresets(branchId: string): Promise<{ data: FrameworkPresetDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('behavioral_framework_presets')
      .select(PRESET_SELECT)
      .or(`is_global.eq.true,branch_id.eq.${branchId}`)
      .order('is_global', { ascending: false })
      .order('preset_name', { ascending: true });
    throwIfDbError(error);

    const rows = (data || []) as PresetRow[];
    if (rows.length === 0) return { data: [] };

    const cats = await this.loadCategoriesForPresets(rows.map((r) => r.id));
    return {
      data: rows.map((r) => this.mapPreset(r, cats.get(r.id) || [])),
    };
  }

  async getPreset(
    presetId: string,
    branchId: string,
  ): Promise<{ data: FrameworkPresetDto }> {
    const preset = await this.getPresetRow(presetId);
    if (!preset.is_global && preset.branch_id !== branchId) {
      throw new NotFoundException('Framework preset not found');
    }
    const cats = await this.loadCategoriesForPresets([preset.id]);
    return { data: this.mapPreset(preset, cats.get(preset.id) || []) };
  }

  async cloneFromGlobal(
    presetCode: string,
    branchId: string,
  ): Promise<{ data: FrameworkPresetDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: globalRaw, error: gErr } = await supabase
      .from('behavioral_framework_presets')
      .select(PRESET_SELECT)
      .eq('preset_code', presetCode)
      .eq('is_global', true)
      .maybeSingle();
    throwIfDbError(gErr);
    if (!globalRaw) throw new NotFoundException('Global framework preset not found');
    const global = globalRaw as PresetRow;

    const cloneCode = `${presetCode}_${branchId}`;
    const { data: existingClone, error: exErr } = await supabase
      .from('behavioral_framework_presets')
      .select(PRESET_SELECT)
      .eq('preset_code', cloneCode)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(exErr);
    if (existingClone) {
      const cats = await this.loadCategoriesForPresets([(existingClone as PresetRow).id]);
      return {
        data: this.mapPreset(existingClone as PresetRow, cats.get((existingClone as PresetRow).id) || []),
      };
    }

    const { data: created, error: cErr } = await supabase
      .from('behavioral_framework_presets')
      .insert({
        branch_id: branchId,
        preset_code: cloneCode,
        preset_name: global.preset_name,
        description: global.description,
        is_global: false,
        default_rating_scale: global.default_rating_scale,
        comments_required: global.comments_required,
      })
      .select(PRESET_SELECT)
      .single();
    throwIfDbError(cErr);
    if (!created) throw new BadRequestException('Failed to clone framework preset');
    const clone = created as PresetRow;

    const sourceCats = await this.loadCategoriesForPresets([global.id]);
    const sourceList = sourceCats.get(global.id) || [];
    if (sourceList.length > 0) {
      const { error: catErr } = await supabase.from('behavioral_framework_categories').insert(
        sourceList.map((c) => ({
          preset_id: clone.id,
          category_name: c.category_name,
          description: c.description,
          sort_order: c.sort_order,
          indicators: c.indicators,
        })),
      );
      throwIfDbError(catErr);
    }

    const cats = await this.loadCategoriesForPresets([clone.id]);
    return { data: this.mapPreset(clone, cats.get(clone.id) || []) };
  }

  async createBlankPreset(
    branchId: string,
    dto: CreateBlankFrameworkPresetDto,
  ): Promise<{ data: FrameworkPresetDto }> {
    const supabase = this.supabaseConfig.getClient();
    const scale = dto.defaultRatingScale?.length
      ? dto.defaultRatingScale.map((l) => ({
          code: l.code.trim(),
          label: l.label.trim(),
          order: l.order,
          ...(l.color ? { color: l.color } : {}),
        }))
      : DEFAULT_BLANK_SCALE;

    const { data, error } = await supabase
      .from('behavioral_framework_presets')
      .insert({
        branch_id: branchId,
        preset_code: null,
        preset_name: dto.presetName.trim(),
        description: dto.description?.trim() || null,
        is_global: false,
        default_rating_scale: scale,
        comments_required: dto.commentsRequired ?? false,
      })
      .select(PRESET_SELECT)
      .single();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to create framework preset');
    return { data: this.mapPreset(data as PresetRow, []) };
  }

  async updatePreset(
    presetId: string,
    branchId: string,
    dto: UpdateFrameworkPresetDto,
  ): Promise<{ data: FrameworkPresetDto }> {
    const preset = await this.getPresetRow(presetId);
    if (preset.is_global) {
      throw new ForbiddenException('Global framework presets are read-only');
    }
    await this.assertBranchOwnedPreset(preset, branchId);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.presetName !== undefined) update.preset_name = dto.presetName.trim();
    if (dto.description !== undefined) update.description = dto.description?.trim() || null;
    if (dto.commentsRequired !== undefined) update.comments_required = dto.commentsRequired;
    if (dto.defaultRatingScale !== undefined) {
      update.default_rating_scale = dto.defaultRatingScale.map((l) => ({
        code: l.code.trim(),
        label: l.label.trim(),
        order: l.order,
        ...(l.color ? { color: l.color } : {}),
      }));
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('behavioral_framework_presets')
      .update(update)
      .eq('id', presetId)
      .eq('branch_id', branchId)
      .select(PRESET_SELECT)
      .single();
    throwIfDbError(error);
    const cats = await this.loadCategoriesForPresets([presetId]);
    return { data: this.mapPreset(data as PresetRow, cats.get(presetId) || []) };
  }

  async deletePreset(presetId: string, branchId: string): Promise<{ data: { id: string } }> {
    const preset = await this.getPresetRow(presetId);
    if (preset.is_global) {
      throw new ForbiddenException('Global framework presets are read-only');
    }
    await this.assertBranchOwnedPreset(preset, branchId);

    const supabase = this.supabaseConfig.getClient();
    const { count, error: cErr } = await supabase
      .from('student_framework_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('preset_id', presetId);
    throwIfDbError(cErr);
    if ((count ?? 0) > 0) {
      throw new ConflictException('Cannot delete preset while student ratings reference it');
    }

    const { data: configUsing } = await supabase
      .from('branch_behavioral_config')
      .select('id')
      .eq('framework_preset_id', presetId)
      .maybeSingle();
    if (configUsing) {
      throw new ConflictException(
        'Cannot delete preset while it is the active framework preset for this branch',
      );
    }

    const { error } = await supabase
      .from('behavioral_framework_presets')
      .delete()
      .eq('id', presetId)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    return { data: { id: presetId } };
  }

  async addCategory(
    presetId: string,
    branchId: string,
    dto: CreateFrameworkCategoryDto,
  ): Promise<{ data: FrameworkCategoryDto }> {
    const preset = await this.getPresetRow(presetId);
    if (preset.is_global) {
      throw new ForbiddenException('Global framework presets are read-only');
    }
    await this.assertBranchOwnedPreset(preset, branchId);

    const supabase = this.supabaseConfig.getClient();
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const { data: maxRows } = await supabase
        .from('behavioral_framework_categories')
        .select('sort_order')
        .eq('preset_id', presetId)
        .order('sort_order', { ascending: false })
        .limit(1);
      const max = (maxRows?.[0] as { sort_order?: number } | undefined)?.sort_order;
      sortOrder = typeof max === 'number' ? max + 1 : 0;
    }

    const { data, error } = await supabase
      .from('behavioral_framework_categories')
      .insert({
        preset_id: presetId,
        category_name: dto.categoryName.trim(),
        description: dto.description?.trim() || null,
        sort_order: sortOrder,
        indicators: (dto.indicators || []).map((i) => i.trim()).filter(Boolean),
      })
      .select(CATEGORY_SELECT)
      .single();
    throwIfDbError(error);
    return { data: this.mapCategory(data as CategoryRow) };
  }

  async updateCategory(
    categoryId: string,
    branchId: string,
    dto: UpdateFrameworkCategoryDto,
  ): Promise<{ data: FrameworkCategoryDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: catRaw, error: catErr } = await supabase
      .from('behavioral_framework_categories')
      .select(CATEGORY_SELECT)
      .eq('id', categoryId)
      .maybeSingle();
    throwIfDbError(catErr);
    if (!catRaw) throw new NotFoundException('Framework category not found');
    const cat = catRaw as CategoryRow;

    const preset = await this.getPresetRow(cat.preset_id);
    if (preset.is_global) {
      throw new ForbiddenException('Global framework presets are read-only');
    }
    await this.assertBranchOwnedPreset(preset, branchId);

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.categoryName !== undefined) update.category_name = dto.categoryName.trim();
    if (dto.description !== undefined) update.description = dto.description?.trim() || null;
    if (dto.sortOrder !== undefined) update.sort_order = dto.sortOrder;
    if (dto.indicators !== undefined) {
      update.indicators = dto.indicators.map((i) => i.trim()).filter(Boolean);
    }

    const { data, error } = await supabase
      .from('behavioral_framework_categories')
      .update(update)
      .eq('id', categoryId)
      .select(CATEGORY_SELECT)
      .single();
    throwIfDbError(error);
    return { data: this.mapCategory(data as CategoryRow) };
  }

  async deleteCategory(
    categoryId: string,
    branchId: string,
  ): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: catRaw, error: catErr } = await supabase
      .from('behavioral_framework_categories')
      .select(CATEGORY_SELECT)
      .eq('id', categoryId)
      .maybeSingle();
    throwIfDbError(catErr);
    if (!catRaw) throw new NotFoundException('Framework category not found');
    const cat = catRaw as CategoryRow;

    const preset = await this.getPresetRow(cat.preset_id);
    if (preset.is_global) {
      throw new ForbiddenException('Global framework presets are read-only');
    }
    await this.assertBranchOwnedPreset(preset, branchId);

    const { count, error: cErr } = await supabase
      .from('student_framework_category_scores')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);
    throwIfDbError(cErr);
    if ((count ?? 0) > 0) {
      throw new ConflictException('Cannot delete category while scores reference it');
    }

    const { error } = await supabase
      .from('behavioral_framework_categories')
      .delete()
      .eq('id', categoryId);
    throwIfDbError(error);
    return { data: { id: categoryId } };
  }

  private async requireFrameworkConfig(branchId: string): Promise<{
    config: ConfigRow;
    preset: PresetRow;
    categories: CategoryRow[];
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branch_behavioral_config')
      .select(
        'id, branch_id, active_system, framework_preset_id, switched_at, switched_by, created_at, updated_at',
      )
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data || (data as ConfigRow).active_system !== 'framework_based') {
      throw new BadRequestException(
        'Framework ratings are only allowed when the branch active system is framework_based',
      );
    }
    const config = data as ConfigRow;
    if (!config.framework_preset_id) {
      throw new BadRequestException('No active framework preset configured for this branch');
    }
    const preset = await this.getPresetRow(config.framework_preset_id);
    if (preset.branch_id !== branchId || preset.is_global) {
      throw new BadRequestException('Active framework preset must be branch-owned');
    }
    const catsMap = await this.loadCategoriesForPresets([preset.id]);
    const categories = catsMap.get(preset.id) || [];
    if (categories.length === 0) {
      throw new BadRequestException('Active framework preset has no categories');
    }
    return { config, preset, categories };
  }

  private validateCategoryScores(
    items: FrameworkCategoryScoreItemDto[],
    categories: CategoryRow[],
    preset: PresetRow,
  ): Map<string, CategoryRow> {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const scaleCodes = new Set(parseScale(preset.default_rating_scale).map((l) => l.code));
    if (scaleCodes.size === 0) {
      throw new BadRequestException('Preset rating scale is empty');
    }

    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.categoryId)) {
        throw new BadRequestException(`Duplicate category score for ${item.categoryId}`);
      }
      seen.add(item.categoryId);
      const cat = byId.get(item.categoryId);
      if (!cat) {
        throw new BadRequestException(
          `Category ${item.categoryId} is not part of the active framework preset`,
        );
      }
      if (!scaleCodes.has(item.ratingCode.trim())) {
        throw new BadRequestException(
          `Invalid ratingCode "${item.ratingCode}". Allowed: ${[...scaleCodes].join(', ')}`,
        );
      }
      if (preset.comments_required && !item.teacherComment?.trim()) {
        throw new BadRequestException(
          `teacherComment is required for category "${cat.category_name}"`,
        );
      }
    }

    for (const cat of categories) {
      if (!seen.has(cat.id)) {
        throw new BadRequestException(
          `Missing score for category "${cat.category_name}"`,
        );
      }
    }

    return byId;
  }

  async createRating(
    dto: CreateFrameworkRatingDto,
    userId: string,
    branchId: string,
  ): Promise<{ data: FrameworkRatingDto }> {
    const assessmentMonth = normalizeAssessmentMonth(dto.assessmentMonth);
    const { preset, categories } = await this.requireFrameworkConfig(branchId);
    const byId = this.validateCategoryScores(dto.categoryScores, categories, preset);

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');

    const supabase = this.supabaseConfig.getClient();
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, branch_id')
      .eq('id', dto.studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(sErr);
    if (!student) throw new NotFoundException('Student not found in this branch');

    const { data: existing } = await supabase
      .from('student_framework_ratings')
      .select('id')
      .eq('student_id', dto.studentId)
      .eq('rated_by', userId)
      .eq('assessment_month', assessmentMonth)
      .maybeSingle();
    if (existing) {
      throw new ConflictException(
        'A framework rating already exists for this student, teacher, and month',
      );
    }

    const { data: ratingRaw, error: rErr } = await supabase
      .from('student_framework_ratings')
      .insert({
        student_id: dto.studentId,
        branch_id: branchId,
        academic_year_id: activeYear.id,
        preset_id: preset.id,
        rating_period: 'monthly',
        period_label: periodLabelFromMonth(assessmentMonth),
        assessment_month: assessmentMonth,
        rated_by: userId,
        rated_at: new Date().toISOString(),
      })
      .select(RATING_SELECT)
      .single();
    throwIfDbError(rErr);
    if (!ratingRaw) throw new BadRequestException('Failed to create framework rating');
    const rating = ratingRaw as RatingRow;

    const scoreRows = dto.categoryScores.map((item) => {
      const cat = byId.get(item.categoryId)!;
      return {
        rating_id: rating.id,
        category_id: item.categoryId,
        category_name: cat.category_name,
        rating_code: item.ratingCode.trim(),
        teacher_comment: item.teacherComment?.trim() || null,
        branch_id: branchId,
      };
    });
    const { error: scErr } = await supabase
      .from('student_framework_category_scores')
      .insert(scoreRows);
    throwIfDbError(scErr);

    return this.getRatingById(rating.id, branchId);
  }

  private async getRatingById(
    ratingId: string,
    branchId: string,
  ): Promise<{ data: FrameworkRatingDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('student_framework_ratings')
      .select(RATING_SELECT)
      .eq('id', ratingId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Framework rating not found');
    const rating = data as RatingRow;

    const { data: scores, error: sErr } = await supabase
      .from('student_framework_category_scores')
      .select(SCORE_SELECT)
      .eq('rating_id', ratingId);
    throwIfDbError(sErr);

    return { data: this.mapRating(rating, (scores || []) as ScoreRow[]) };
  }

  async getRatingsForStudent(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: FrameworkRatingDto[] }> {
    let yearId = academicYearId;
    if (!yearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) throw new BadRequestException('No active academic year found');
      yearId = activeYear.id;
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: ratings, error } = await supabase
      .from('student_framework_ratings')
      .select(RATING_SELECT)
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .order('assessment_month', { ascending: false });
    throwIfDbError(error);
    const rows = (ratings || []) as RatingRow[];
    if (rows.length === 0) return { data: [] };

    const ids = rows.map((r) => r.id);
    const { data: scores, error: sErr } = await supabase
      .from('student_framework_category_scores')
      .select(SCORE_SELECT)
      .in('rating_id', ids);
    throwIfDbError(sErr);

    const byRating = new Map<string, ScoreRow[]>();
    for (const s of (scores || []) as ScoreRow[]) {
      const list = byRating.get(s.rating_id) || [];
      list.push(s);
      byRating.set(s.rating_id, list);
    }

    return {
      data: rows.map((r) => this.mapRating(r, byRating.get(r.id) || [])),
    };
  }

  async updateRating(
    ratingId: string,
    dto: UpdateFrameworkRatingDto,
    userId: string,
    branchId: string,
  ): Promise<{ data: FrameworkRatingDto }> {
    const { preset, categories } = await this.requireFrameworkConfig(branchId);
    const byId = this.validateCategoryScores(dto.categoryScores, categories, preset);

    const supabase = this.supabaseConfig.getClient();
    const { data: existing, error } = await supabase
      .from('student_framework_ratings')
      .select(RATING_SELECT)
      .eq('id', ratingId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!existing) throw new NotFoundException('Framework rating not found');
    const rating = existing as RatingRow;
    if (rating.rated_by !== userId) {
      throw new ForbiddenException('You can only update your own framework ratings');
    }
    if (rating.preset_id !== preset.id) {
      throw new BadRequestException(
        'Cannot update a rating that belongs to a different framework preset than the active one',
      );
    }

    const { error: delErr } = await supabase
      .from('student_framework_category_scores')
      .delete()
      .eq('rating_id', ratingId);
    throwIfDbError(delErr);

    const scoreRows = dto.categoryScores.map((item) => {
      const cat = byId.get(item.categoryId)!;
      return {
        rating_id: ratingId,
        category_id: item.categoryId,
        category_name: cat.category_name,
        rating_code: item.ratingCode.trim(),
        teacher_comment: item.teacherComment?.trim() || null,
        branch_id: branchId,
      };
    });
    const { error: insErr } = await supabase
      .from('student_framework_category_scores')
      .insert(scoreRows);
    throwIfDbError(insErr);

    const { error: updErr } = await supabase
      .from('student_framework_ratings')
      .update({
        rated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ratingId);
    throwIfDbError(updErr);

    return this.getRatingById(ratingId, branchId);
  }

  async deleteRating(
    ratingId: string,
    userId: string,
    branchId: string,
    isAdmin: boolean,
  ): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing, error } = await supabase
      .from('student_framework_ratings')
      .select('id, rated_by')
      .eq('id', ratingId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!existing) throw new NotFoundException('Framework rating not found');
    const row = existing as { id: string; rated_by: string };
    if (!isAdmin && row.rated_by !== userId) {
      throw new ForbiddenException('You can only delete your own framework ratings');
    }

    const { error: delErr } = await supabase
      .from('student_framework_ratings')
      .delete()
      .eq('id', ratingId)
      .eq('branch_id', branchId);
    throwIfDbError(delErr);
    return { data: { id: ratingId } };
  }

  async getCombinedStudentHistory(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: CombinedBehavioralHistoryDto }> {
    let yearId = academicYearId;
    if (!yearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) throw new BadRequestException('No active academic year found');
      yearId = activeYear.id;
    }

    const supabase = this.supabaseConfig.getClient();

    const [starAssessmentsRes, frameworkRatings] = await Promise.all([
      supabase
        .from('behavioral_assessments')
        .select(
          'id, student_id, assessed_by, assessment_month, branch_id, academic_year_id, created_at, updated_at',
        )
        .eq('student_id', studentId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', yearId)
        .order('assessment_month', { ascending: false }),
      this.getRatingsForStudent(studentId, branchId, yearId),
    ]);
    throwIfDbError(starAssessmentsRes.error);

    const starAssessments = (starAssessmentsRes.data || []) as Array<{
      id: string;
      assessed_by: string;
      assessment_month: string;
      created_at: string;
      updated_at: string;
    }>;

    const starScoresByAssessment = new Map<
      string,
      Array<{ id: string; attribute_name: string; score: number }>
    >();
    if (starAssessments.length > 0) {
      const { data: scoreRows, error: scErr } = await supabase
        .from('behavioral_scores')
        .select('id, behavioral_assessment_id, attribute_name, score')
        .in(
          'behavioral_assessment_id',
          starAssessments.map((a) => a.id),
        );
      throwIfDbError(scErr);
      for (const row of scoreRows || []) {
        const r = row as {
          id: string;
          behavioral_assessment_id: string;
          attribute_name: string;
          score: number;
        };
        const list = starScoresByAssessment.get(r.behavioral_assessment_id) || [];
        list.push(r);
        starScoresByAssessment.set(r.behavioral_assessment_id, list);
      }
    }

    const entries: CombinedHistoryEntryDto[] = [];

    for (const a of starAssessments) {
      const scores = starScoresByAssessment.get(a.id) || [];
      entries.push(
        new CombinedHistoryEntryDto({
          period: a.assessment_month,
          systemType: 'star_based',
          payload: {
            id: a.id,
            assessedBy: a.assessed_by,
            scores: scores.map(
              (s) =>
                ({
                  id: s.id,
                  attributeName: s.attribute_name,
                  score: s.score,
                }) satisfies StarHistoryScoreDto,
            ),
            createdAt: a.created_at,
            updatedAt: a.updated_at,
          } satisfies StarHistoryEntryDto,
        }),
      );
    }

    for (const r of frameworkRatings.data) {
      entries.push(
        new CombinedHistoryEntryDto({
          period: r.assessmentMonth,
          systemType: 'framework_based',
          payload: {
            id: r.id,
            ratedBy: r.ratedBy,
            presetId: r.presetId,
            periodLabel: r.periodLabel,
            categoryScores: r.categoryScores,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          } satisfies FrameworkHistoryEntryDto,
        }),
      );
    }

    entries.sort((a, b) => b.period.localeCompare(a.period));

    return {
      data: new CombinedBehavioralHistoryDto({ entries }),
    };
  }

  async getClassReport(
    classSectionId: string,
    assessmentMonthRaw: string | undefined,
    branchId: string,
  ): Promise<{ data: ClassFrameworkReportDto }> {
    const assessmentMonth = assessmentMonthRaw
      ? normalizeAssessmentMonth(assessmentMonthRaw)
      : firstDayOfMonth(new Date());

    const configResult = await this.getConfig(branchId);
    const activeSystem = configResult.data.activeSystem;

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');

    const supabase = this.supabaseConfig.getClient();
    const { data: cs, error: csErr } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id, branch_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csErr);
    if (!cs) throw new NotFoundException('Class section not found');

    const studentIds =
      await this.studentPlacementService.listActiveStudentIdsForClassSection({
        branchId,
        academicYearId: activeYear.id,
        classId: (cs as { class_id: string }).class_id,
        sectionId: (cs as { section_id: string }).section_id,
      });

    if (studentIds.length === 0) {
      return {
        data: new ClassFrameworkReportDto({
          classSectionId,
          assessmentMonth,
          activeSystem,
          students: [],
        }),
      };
    }

    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name')
      .in('id', studentIds);
    throwIfDbError(stErr);

    const ratingsByStudent = new Map<string, FrameworkRatingDto>();
    if (activeSystem === 'framework_based') {
      const { data: ratings, error: rErr } = await supabase
        .from('student_framework_ratings')
        .select(RATING_SELECT)
        .eq('branch_id', branchId)
        .eq('assessment_month', assessmentMonth)
        .in('student_id', studentIds);
      throwIfDbError(rErr);
      const ratingRows = (ratings || []) as RatingRow[];
      if (ratingRows.length > 0) {
        const { data: scores, error: scErr } = await supabase
          .from('student_framework_category_scores')
          .select(SCORE_SELECT)
          .in(
            'rating_id',
            ratingRows.map((r) => r.id),
          );
        throwIfDbError(scErr);
        const byRating = new Map<string, ScoreRow[]>();
        for (const s of (scores || []) as ScoreRow[]) {
          const list = byRating.get(s.rating_id) || [];
          list.push(s);
          byRating.set(s.rating_id, list);
        }
        for (const r of ratingRows) {
          // Prefer most recent if multiple teachers rated; keep first by rated_at desc
          const existing = ratingsByStudent.get(r.student_id);
          const mapped = this.mapRating(r, byRating.get(r.id) || []);
          if (!existing || mapped.ratedAt > existing.ratedAt) {
            ratingsByStudent.set(r.student_id, mapped);
          }
        }
      }
    }

    const list: ClassFrameworkReportStudentDto[] = (
      (students || []) as Array<{
        id: string;
        student_id: string;
        first_name: string | null;
        last_name: string | null;
      }>
    ).map((s) => ({
      studentId: s.id,
      schoolStudentId: s.student_id,
      firstName: s.first_name ?? '',
      lastName: s.last_name ?? '',
      rating: ratingsByStudent.get(s.id),
    }));

    return {
      data: new ClassFrameworkReportDto({
        classSectionId,
        assessmentMonth,
        activeSystem,
        students: list,
      }),
    };
  }
}
