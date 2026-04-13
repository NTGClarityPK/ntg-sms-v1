import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { SubjectDto } from './dto/subject.dto';
import { QueryClassesDto } from './dto/query-classes.dto';
import { ClassDto } from './dto/class.dto';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { SectionDto } from './dto/section.dto';
import { QueryLevelsDto } from './dto/query-levels.dto';
import { LevelDto } from './dto/level.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';
import { assertSchoolAdminForBranch } from '../../common/utils/branch-roles.util';
import { DeletionBlockerDto, DeletionStatusDto, EntityDeletedDto } from './dto/deletion-status.dto';

type Meta = { total: number; page: number; limit: number; totalPages: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type SubjectRow = {
  id: string;
  name: string;
  name_ar: string | null;
  name_translations?: Record<string, string> | null;
  code: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  branch_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
  updated_by: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
  updated_by: string | null;
};

type SectionRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  branch_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
  updated_by: string | null;
};

type LevelRow = {
  id: string;
  name: string;
  name_ar: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  branch_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
  updated_by: string | null;
};

type LevelClassRow = {
  level_id: string;
  class_id: string;
};

function resolveTranslatedName(
  row: { name: string; name_translations?: Record<string, string> | null },
  language: string,
): string {
  const t = row.name_translations;
  return (t?.[language] ?? t?.en ?? row.name) || row.name;
}

function mapSubject(row: SubjectRow, language: string = 'ar'): SubjectDto {
  const name = resolveTranslatedName(row, language);
  return new SubjectDto({
    id: row.id,
    name,
    nameAr: row.name_ar ?? undefined,
    code: row.code ?? undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapClass(row: ClassRow): ClassDto {
  return new ClassDto({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapSection(row: SectionRow): SectionDto {
  return new SectionDto({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapLevel(row: LevelRow, classes: ClassDto[]): LevelDto {
  return new LevelDto({
    id: row.id,
    name: row.name,
    nameAr: row.name_ar ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    classes,
  });
}

@Injectable()
export class CoreLookupsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listSubjects(query: QuerySubjectsDto, branchId: string): Promise<{ data: SubjectDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const language = query.language ?? 'ar';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('subjects')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      dbQuery = dbQuery.or(`name.ilike.%${query.search}%,code.ilike.%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: (data as SubjectRow[]).map((row) => mapSubject(row, language)),
      meta: { total, page, limit, totalPages },
    };
  }

  async createSubject(
    input: {
      name: string;
      nameAr?: string;
      name_translations?: Record<string, string>;
      code?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<SubjectDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    // Idempotent behaviour for onboarding: if subject code already exists in this branch, return it.
    const code = (input.code ?? '').trim();
    if (code) {
      const { data: existing, error: existingError } = await supabase
        .from('subjects')
        .select('*')
        .eq('branch_id', branchId)
        .eq('code', code)
        .maybeSingle();
      throwIfDbError(existingError);
      if (existing) return mapSubject(existing as SubjectRow, 'ar');
    }

    const nameTranslations = input.name_translations;
    const resolvedNameAr = input.nameAr ?? nameTranslations?.ar;
    const insertPayload = {
      name: input.name,
      name_ar: resolvedNameAr ?? null,
      name_translations: nameTranslations ?? { en: input.name, ar: resolvedNameAr ?? input.name },
      code: code || null,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
      branch_id: branchId,
      tenant_id: tenantId,
      created_by: username,
      updated_by: username,
    };
    const { data, error } = await supabase
      .from('subjects')
      .insert(insertPayload)
      .select('*')
      .single();
    throwIfDbError(error);
    const row = data as SubjectRow;
    this.auditLogService
      .logCreate('subjects', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});
    return mapSubject(row, 'ar');
  }

  async updateSubject(
    id: string,
    input: UpdateSubjectDto,
    branchId: string,
    userEmail: string,
  ): Promise<SubjectDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);
    const { data: oldRow, error: fetchError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Subject not found');
    const updates: Partial<SubjectRow> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.nameAr !== undefined) updates.name_ar = input.nameAr || null;
    if (input.name_translations !== undefined) updates.name_translations = input.name_translations;
    if (input.nameAr === undefined && input.name_translations?.ar !== undefined) {
      updates.name_ar = input.name_translations.ar || null;
    }
    if (input.code !== undefined) updates.code = input.code || null;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
    updates.updated_by = username;
    if (Object.keys(updates).length === 1 && updates.updated_by) {
      return mapSubject(oldRow as SubjectRow, 'ar');
    }
    const { data, error } = await supabase
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Subject not found');
    const newRow = data as SubjectRow;
    this.auditLogService
      .logUpdate(
        'subjects',
        id,
        userEmail,
        { ...oldRow } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        Object.keys(updates).filter((k) => k !== 'updated_by'),
        { branchId },
      )
      .catch(() => {});
    return mapSubject(newRow, 'ar');
  }

  async listClasses(query: QueryClassesDto, branchId: string): Promise<{ data: ClassDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    if (query.levelId) {
      // Filter by level via junction table - but ensure level belongs to branch
      const { data: level, error: levelError } = await supabase
        .from('levels')
        .select('id')
        .eq('id', query.levelId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(levelError);

      if (!level) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }

      const { data: lc, error: lcError } = await supabase
        .from('level_classes')
        .select('class_id')
        .eq('level_id', query.levelId);
      throwIfDbError(lcError);

      const classIds = (lc as Pick<LevelClassRow, 'class_id'>[]).map((r) => r.class_id);
      if (classIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }

      let dbQuery = supabase
        .from('classes')
        .select('*', { count: 'exact' })
        .in('id', classIds)
        .eq('branch_id', branchId)
        .range(from, to)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (query.search) {
        dbQuery = dbQuery.or(`name.ilike.%${query.search}%,display_name.ilike.%${query.search}%`);
      }

      const { data, error, count } = await dbQuery;
      throwIfDbError(error);
      const total = count ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return {
        data: (data as ClassRow[]).map(mapClass),
        meta: { total, page, limit, totalPages },
      };
    }

    let dbQuery = supabase
      .from('classes')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      dbQuery = dbQuery.or(`name.ilike.%${query.search}%,display_name.ilike.%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: (data as ClassRow[]).map(mapClass),
      meta: { total, page, limit, totalPages },
    };
  }

  async createClass(
    input: {
      name: string;
      displayName: string;
      sortOrder: number;
      isActive?: boolean;
    },
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<ClassDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    // Shift existing classes so that the new position is free: all with sort_order >= position get +1
    const { error: shiftError } = await supabase.rpc('shift_class_sort_orders', {
      p_branch_id: branchId,
      p_from_position: input.sortOrder,
    });
    throwIfDbError(shiftError);

    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: input.name,
        display_name: input.displayName,
        sort_order: input.sortOrder,
        is_active: input.isActive ?? true,
        branch_id: branchId,
        tenant_id: tenantId,
        created_by: username,
        updated_by: username,
      })
      .select('*')
      .single();
    throwIfDbError(error);
    const row = data as ClassRow;
    this.auditLogService
      .logCreate('classes', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});
    return mapClass(row);
  }

  async updateClass(
    id: string,
    input: UpdateClassDto,
    branchId: string,
    userEmail: string,
  ): Promise<ClassDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);
    const { data: oldRow, error: fetchError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Class not found');
    const updates: Partial<ClassRow> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    updates.updated_by = username;
    if (Object.keys(updates).length === 1 && updates.updated_by) {
      return mapClass(oldRow as ClassRow);
    }
    const { data, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Class not found');
    const newRow = data as ClassRow;
    this.auditLogService
      .logUpdate(
        'classes',
        id,
        userEmail,
        { ...oldRow } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        Object.keys(updates).filter((k) => k !== 'updated_by'),
        { branchId },
      )
      .catch(() => {});
    return mapClass(newRow);
  }

  async listSections(query: QuerySectionsDto, branchId: string): Promise<{ data: SectionDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('sections')
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
    return {
      data: (data as SectionRow[]).map(mapSection),
      meta: { total, page, limit, totalPages },
    };
  }

  async createSection(
    input: {
      name: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<SectionDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);
    const { data, error } = await supabase
      .from('sections')
      .insert({
        name: input.name,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
        created_by: username,
        updated_by: username,
      })
      .select('*')
      .single();
    throwIfDbError(error);
    const row = data as SectionRow;
    this.auditLogService
      .logCreate('sections', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});
    return mapSection(row);
  }

  async updateSection(
    id: string,
    input: UpdateSectionDto,
    branchId: string,
    userEmail: string,
  ): Promise<SectionDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);
    const { data: oldRow, error: fetchError } = await supabase
      .from('sections')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Section not found');
    const updates: Partial<SectionRow> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
    updates.updated_by = username;
    if (Object.keys(updates).length === 1 && updates.updated_by) {
      return mapSection(oldRow as SectionRow);
    }
    const { data, error } = await supabase
      .from('sections')
      .update(updates)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Section not found');
    const newRow = data as SectionRow;
    this.auditLogService
      .logUpdate(
        'sections',
        id,
        userEmail,
        { ...oldRow } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        Object.keys(updates).filter((k) => k !== 'updated_by'),
        { branchId },
      )
      .catch(() => {});
    return mapSection(newRow);
  }

  private async collectSubjectDeletionBlockers(subjectId: string, branchId: string): Promise<DeletionBlockerDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data: templates, error: templatesError } = await supabase
      .from('subject_templates')
      .select('id')
      .eq('branch_id', branchId);
    throwIfDbError(templatesError);
    const templateIds = (templates ?? []).map((t: { id: string }) => t.id);

    const [stsRes, taRes, assRes, ttRes, libRes] = await Promise.all([
      templateIds.length === 0
        ? Promise.resolve({ count: 0 as number, error: null as PostgrestError | null })
        : supabase
            .from('subject_template_subjects')
            .select('subject_template_id', { count: 'exact', head: true })
            .eq('subject_id', subjectId)
            .in('subject_template_id', templateIds),
      supabase
        .from('teacher_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subjectId)
        .eq('branch_id', branchId),
      supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subjectId)
        .eq('branch_id', branchId),
      supabase
        .from('timetable_slots')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subjectId)
        .eq('branch_id', branchId),
      supabase
        .from('library_items')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subjectId)
        .eq('branch_id', branchId),
    ]);

    throwIfDbError(stsRes.error);
    throwIfDbError(taRes.error);
    throwIfDbError(assRes.error);
    throwIfDbError(ttRes.error);
    throwIfDbError(libRes.error);

    const blockers: DeletionBlockerDto[] = [];
    const pushIf = (type: string, count: number | null | undefined) => {
      const n = count ?? 0;
      if (n > 0) blockers.push(new DeletionBlockerDto({ type, count: n }));
    };

    pushIf('subject_template_subjects', stsRes.count);
    pushIf('teacher_assignments', taRes.count);
    pushIf('assessments', assRes.count);
    pushIf('timetable_slots', ttRes.count);
    pushIf('library_items', libRes.count);
    return blockers;
  }

  private async collectClassDeletionBlockers(classId: string, branchId: string): Promise<DeletionBlockerDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // level_classes has no branch_id; constrain via levels.branch_id
    const { data: lcRows, error: lcErr } = await supabase
      .from('level_classes')
      .select('level_id')
      .eq('class_id', classId);
    throwIfDbError(lcErr);

    const levelIds = Array.from(new Set((lcRows ?? []).map((r: { level_id: string }) => r.level_id)));
    let levelClassesInBranch = 0;
    if (levelIds.length > 0) {
      const { data: levelRows, error: levErr } = await supabase
        .from('levels')
        .select('id')
        .in('id', levelIds)
        .eq('branch_id', branchId);
      throwIfDbError(levErr);
      const allowed = new Set((levelRows ?? []).map((r: { id: string }) => r.id));
      levelClassesInBranch = (lcRows ?? []).filter((r: { level_id: string }) => allowed.has(r.level_id)).length;
    }

    const [csRes, cstaRes, cgaRes, ctaRes, stuRes, seRes, spdRes, libRes] = await Promise.all([
      supabase
        .from('class_sections')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('branch_id', branchId),
      supabase
        .from('class_subject_template_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('branch_id', branchId),
      supabase
        .from('class_grade_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId),
      supabase
        .from('class_timing_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId),
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('branch_id', branchId),
      supabase
        .from('student_enrolments')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('branch_id', branchId),
      supabase
        .from('student_promotion_decisions')
        .select('id', { count: 'exact', head: true })
        .eq('target_class_id', classId)
        .eq('branch_id', branchId),
      supabase
        .from('library_items')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('branch_id', branchId),
    ]);

    throwIfDbError(csRes.error);
    throwIfDbError(cstaRes.error);
    throwIfDbError(cgaRes.error);
    throwIfDbError(ctaRes.error);
    throwIfDbError(stuRes.error);
    throwIfDbError(seRes.error);
    throwIfDbError(spdRes.error);
    throwIfDbError(libRes.error);

    const blockers: DeletionBlockerDto[] = [];
    const pushIf = (type: string, count: number | null | undefined) => {
      const n = count ?? 0;
      if (n > 0) blockers.push(new DeletionBlockerDto({ type, count: n }));
    };
    pushIf('class_sections', csRes.count);
    if (levelClassesInBranch > 0) blockers.push(new DeletionBlockerDto({ type: 'level_classes', count: levelClassesInBranch }));
    pushIf('class_subject_template_assignments', cstaRes.count);
    pushIf('class_grade_assignments', cgaRes.count);
    pushIf('class_timing_assignments', ctaRes.count);
    pushIf('students', stuRes.count);
    pushIf('student_enrolments', seRes.count);
    pushIf('student_promotion_decisions', spdRes.count);
    pushIf('library_items', libRes.count);
    return blockers;
  }

  private async collectSectionDeletionBlockers(sectionId: string, branchId: string): Promise<DeletionBlockerDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const [csRes, stuRes, seRes, spdRes] = await Promise.all([
      supabase
        .from('class_sections')
        .select('id', { count: 'exact', head: true })
        .eq('section_id', sectionId)
        .eq('branch_id', branchId),
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('section_id', sectionId)
        .eq('branch_id', branchId),
      supabase
        .from('student_enrolments')
        .select('id', { count: 'exact', head: true })
        .eq('section_id', sectionId)
        .eq('branch_id', branchId),
      supabase
        .from('student_promotion_decisions')
        .select('id', { count: 'exact', head: true })
        .eq('target_section_id', sectionId)
        .eq('branch_id', branchId),
    ]);

    throwIfDbError(csRes.error);
    throwIfDbError(stuRes.error);
    throwIfDbError(seRes.error);
    throwIfDbError(spdRes.error);

    const blockers: DeletionBlockerDto[] = [];
    const pushIf = (type: string, count: number | null | undefined) => {
      const n = count ?? 0;
      if (n > 0) blockers.push(new DeletionBlockerDto({ type, count: n }));
    };
    pushIf('class_sections', csRes.count);
    pushIf('students', stuRes.count);
    pushIf('student_enrolments', seRes.count);
    pushIf('student_promotion_decisions', spdRes.count);
    return blockers;
  }

  async getSubjectDeletionStatus(id: string, branchId: string, userId: string): Promise<{ data: DeletionStatusDto }> {
    const supabase = this.supabaseConfig.getClient();
    await assertSchoolAdminForBranch(supabase, userId, branchId);

    const { data: row, error } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!row) throw new NotFoundException('Subject not found');

    const blockers = await this.collectSubjectDeletionBlockers(id, branchId);
    return { data: new DeletionStatusDto({ canDelete: blockers.length === 0, blockers }) };
  }

  async getClassDeletionStatus(id: string, branchId: string, userId: string): Promise<{ data: DeletionStatusDto }> {
    const supabase = this.supabaseConfig.getClient();
    await assertSchoolAdminForBranch(supabase, userId, branchId);

    const { data: row, error } = await supabase
      .from('classes')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!row) throw new NotFoundException('Class not found');

    const blockers = await this.collectClassDeletionBlockers(id, branchId);
    return { data: new DeletionStatusDto({ canDelete: blockers.length === 0, blockers }) };
  }

  async getSectionDeletionStatus(id: string, branchId: string, userId: string): Promise<{ data: DeletionStatusDto }> {
    const supabase = this.supabaseConfig.getClient();
    await assertSchoolAdminForBranch(supabase, userId, branchId);

    const { data: row, error } = await supabase
      .from('sections')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!row) throw new NotFoundException('Section not found');

    const blockers = await this.collectSectionDeletionBlockers(id, branchId);
    return { data: new DeletionStatusDto({ canDelete: blockers.length === 0, blockers }) };
  }

  async deleteSubject(
    id: string,
    branchId: string,
    userId: string,
    userEmail: string,
  ): Promise<{ data: EntityDeletedDto }> {
    const supabase = this.supabaseConfig.getClient();
    await assertSchoolAdminForBranch(supabase, userId, branchId);

    const { data: oldRow, error: fetchError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Subject not found');

    const blockers = await this.collectSubjectDeletionBlockers(id, branchId);
    if (blockers.length > 0) {
      throw new ConflictException(`Cannot delete subject: ${blockers.map((b) => `${b.type} (${b.count})`).join(', ')}`);
    }

    const { error: delError } = await supabase.from('subjects').delete().eq('id', id).eq('branch_id', branchId);
    throwIfDbError(delError);
    this.auditLogService
      .logDelete('subjects', id, userEmail, { ...oldRow } as Record<string, unknown>, { branchId })
      .catch(() => {});

    return { data: new EntityDeletedDto({ deleted: true }) };
  }

  async deleteClass(id: string, branchId: string, userId: string, userEmail: string): Promise<{ data: EntityDeletedDto }> {
    const supabase = this.supabaseConfig.getClient();
    await assertSchoolAdminForBranch(supabase, userId, branchId);

    const { data: oldRow, error: fetchError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Class not found');

    const blockers = await this.collectClassDeletionBlockers(id, branchId);
    if (blockers.length > 0) {
      throw new ConflictException(`Cannot delete class: ${blockers.map((b) => `${b.type} (${b.count})`).join(', ')}`);
    }

    const { error: delError } = await supabase.from('classes').delete().eq('id', id).eq('branch_id', branchId);
    throwIfDbError(delError);
    this.auditLogService
      .logDelete('classes', id, userEmail, { ...oldRow } as Record<string, unknown>, { branchId })
      .catch(() => {});

    return { data: new EntityDeletedDto({ deleted: true }) };
  }

  async deleteSection(
    id: string,
    branchId: string,
    userId: string,
    userEmail: string,
  ): Promise<{ data: EntityDeletedDto }> {
    const supabase = this.supabaseConfig.getClient();
    await assertSchoolAdminForBranch(supabase, userId, branchId);

    const { data: oldRow, error: fetchError } = await supabase
      .from('sections')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!oldRow) throw new NotFoundException('Section not found');

    const blockers = await this.collectSectionDeletionBlockers(id, branchId);
    if (blockers.length > 0) {
      throw new ConflictException(`Cannot delete section: ${blockers.map((b) => `${b.type} (${b.count})`).join(', ')}`);
    }

    const { error: delError } = await supabase.from('sections').delete().eq('id', id).eq('branch_id', branchId);
    throwIfDbError(delError);
    this.auditLogService
      .logDelete('sections', id, userEmail, { ...oldRow } as Record<string, unknown>, { branchId })
      .catch(() => {});

    return { data: new EntityDeletedDto({ deleted: true }) };
  }

  async listLevels(query: QueryLevelsDto, branchId: string): Promise<{ data: LevelDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let levelsQuery = supabase
      .from('levels')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      levelsQuery = levelsQuery.ilike('name', `%${query.search}%`);
    }

    const { data: levels, error: levelsError, count } = await levelsQuery;
    throwIfDbError(levelsError);

    const levelRows = (levels as LevelRow[]) ?? [];
    const levelIds = levelRows.map((l) => l.id);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (levelIds.length === 0) {
      return { data: [], meta: { total, page, limit, totalPages } };
    }

    const { data: levelClasses, error: lcError } = await supabase
      .from('level_classes')
      .select('level_id,class_id')
      .in('level_id', levelIds);
    throwIfDbError(lcError);

    const pairs = (levelClasses as LevelClassRow[]) ?? [];
    const classIds = Array.from(new Set(pairs.map((p) => p.class_id)));

    let classesById = new Map<string, ClassDto>();
    if (classIds.length > 0) {
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .eq('branch_id', branchId);
      throwIfDbError(classesError);
      classesById = new Map((classes as ClassRow[]).map((c) => [c.id, mapClass(c)]));
    }

    const classesByLevel = new Map<string, ClassDto[]>();
    for (const pair of pairs) {
      const cls = classesById.get(pair.class_id);
      if (!cls) continue;
      const arr = classesByLevel.get(pair.level_id) ?? [];
      arr.push(cls);
      classesByLevel.set(pair.level_id, arr);
    }

    // Keep classes stable by sortOrder then name
    for (const [levelId, arr] of classesByLevel) {
      arr.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      classesByLevel.set(levelId, arr);
    }

    return {
      data: levelRows.map((l) => mapLevel(l, classesByLevel.get(l.id) ?? [])),
      meta: { total, page, limit, totalPages },
    };
  }

  async createLevel(
    input: {
      name: string;
      nameAr?: string;
      sortOrder?: number;
      classIds?: string[];
    },
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<LevelDto> {
    const supabase = this.supabaseConfig.getClient();

    // Validate that classes belong to the same branch and are not already assigned to other levels
    if (input.classIds && input.classIds.length > 0) {
      // First verify all classes belong to this branch
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id, display_name')
        .in('id', input.classIds)
        .eq('branch_id', branchId);
      throwIfDbError(classError);

      if (!classes || classes.length !== input.classIds.length) {
        throw new BadRequestException('Some classes do not exist or do not belong to this branch');
      }

      const { data: existingAssignments, error: checkError } = await supabase
        .from('level_classes')
        .select('class_id, level_id')
        .in('class_id', input.classIds);
      throwIfDbError(checkError);

      if (existingAssignments && existingAssignments.length > 0) {
        // Fetch level names for error message
        const conflictingLevelIds = Array.from(new Set(existingAssignments.map((a: any) => a.level_id)));

        const { data: levels, error: levelError } = await supabase
          .from('levels')
          .select('id, name')
          .in('id', conflictingLevelIds);
        throwIfDbError(levelError);

        const classMap = new Map((classes as any[]).map((c) => [c.id, c.display_name]));
        const levelMap = new Map((levels as any[]).map((l) => [l.id, l.name]));

        const conflicts = existingAssignments.map((a: any) => 
          `${classMap.get(a.class_id)} (already in ${levelMap.get(a.level_id)})`
        ).join(', ');

        throw new BadRequestException(
          `Cannot assign classes that are already in other levels: ${conflicts}`
        );
      }
    }

    const username = extractUsernameFromEmail(userEmail);
    const { data: level, error } = await supabase
      .from('levels')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
        created_by: username,
        updated_by: username,
      })
      .select('*')
      .single();
    throwIfDbError(error);

    const levelRow = level as LevelRow;
    this.auditLogService
      .logCreate('levels', levelRow.id, userEmail, { ...levelRow } as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});

    if (input.classIds && input.classIds.length > 0) {
      const payload = input.classIds.map((classId) => ({
        level_id: levelRow.id,
        class_id: classId,
        created_by: username,
        updated_by: username,
      }));
      const { error: insertLcError } = await supabase.from('level_classes').insert(payload);
      throwIfDbError(insertLcError);
    }

    // Re-fetch nested classes via listLevels logic (single level)
    const { data: lc, error: lcError } = await supabase
      .from('level_classes')
      .select('level_id,class_id')
      .eq('level_id', levelRow.id);
    throwIfDbError(lcError);

    const classIds = Array.from(new Set(((lc as LevelClassRow[]) ?? []).map((p) => p.class_id)));
    let classes: ClassDto[] = [];
    if (classIds.length > 0) {
      const { data: clsRows, error: clsError } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .eq('branch_id', branchId);
      throwIfDbError(clsError);
      classes = (clsRows as ClassRow[]).map(mapClass).sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
    }

    return mapLevel(levelRow, classes);
  }

  async updateLevel(
    id: string,
    input: UpdateLevelDto,
    branchId: string,
    userEmail: string,
  ): Promise<LevelDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    const { data: existingLevel, error: fetchError } = await supabase
      .from('levels')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!existingLevel) throw new NotFoundException('Level not found');

    const levelRow = existingLevel as LevelRow;
    const updates: Partial<LevelRow> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.nameAr !== undefined) updates.name_ar = input.nameAr || null;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
    updates.updated_by = username;

    if (Object.keys(updates).length > 0) {
      const { data: newLevel, error: updateError } = await supabase
        .from('levels')
        .update(updates)
        .eq('id', id)
        .eq('branch_id', branchId)
        .select('*')
        .single();
      throwIfDbError(updateError);
      if (newLevel) {
        this.auditLogService
          .logUpdate(
            'levels',
            id,
            userEmail,
            { ...existingLevel } as Record<string, unknown>,
            { ...newLevel } as Record<string, unknown>,
            Object.keys(updates).filter((k) => k !== 'updated_by'),
            { branchId },
          )
          .catch(() => {});
      }
    }

    if (input.classIds !== undefined) {
      const { error: deleteLcError } = await supabase
        .from('level_classes')
        .delete()
        .eq('level_id', id);
      throwIfDbError(deleteLcError);

      if (input.classIds.length > 0) {
        const { data: classes, error: classError } = await supabase
          .from('classes')
          .select('id')
          .in('id', input.classIds)
          .eq('branch_id', branchId);
        throwIfDbError(classError);
        if (!classes || classes.length !== input.classIds.length) {
          throw new BadRequestException('Some classes do not exist or do not belong to this branch');
        }
        // After delete, check if any of these classes are still assigned to other levels
        const { data: existingAssignments, error: assignError } = await supabase
          .from('level_classes')
          .select('class_id, level_id')
          .in('class_id', input.classIds);
        throwIfDbError(assignError);
        const otherLevelIds = (existingAssignments as LevelClassRow[] ?? []).map((a) => a.level_id);
        if (otherLevelIds.length > 0) {
          const { data: levelRows } = await supabase.from('levels').select('id, name').in('id', [...new Set(otherLevelIds)]);
          const levelMap = new Map((levelRows as { id: string; name: string }[] ?? []).map((l) => [l.id, l.name]));
          const conflictNames = otherLevelIds.map((lid) => levelMap.get(lid)).filter(Boolean);
          throw new BadRequestException(
            `Cannot assign classes already in other levels: ${[...new Set(conflictNames)].join(', ')}`,
          );
        }
        const payload = input.classIds.map((classId) => ({ 
          level_id: id, 
          class_id: classId,
          created_by: username,
          updated_by: username,
        }));
        const { error: insertLcError } = await supabase.from('level_classes').insert(payload);
        throwIfDbError(insertLcError);
      }
    }

    const { data: updated, error: selectError } = await supabase
      .from('levels')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(selectError);
    const finalRow = updated as LevelRow;

    const { data: lc } = await supabase
      .from('level_classes')
      .select('level_id,class_id')
      .eq('level_id', id);
    const classIds = Array.from(new Set(((lc as LevelClassRow[]) ?? []).map((p) => p.class_id)));
    let classes: ClassDto[] = [];
    if (classIds.length > 0) {
      const { data: clsRows, error: clsError } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .eq('branch_id', branchId);
      throwIfDbError(clsError);
      classes = (clsRows as ClassRow[]).map(mapClass).sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
    }
    return mapLevel(finalRow, classes);
  }
}


