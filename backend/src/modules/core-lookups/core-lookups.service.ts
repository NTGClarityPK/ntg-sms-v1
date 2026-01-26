import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { SubjectDto } from './dto/subject.dto';
import { QueryClassesDto } from './dto/query-classes.dto';
import { ClassDto } from './dto/class.dto';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { SectionDto } from './dto/section.dto';
import { QueryLevelsDto } from './dto/query-levels.dto';
import { LevelDto } from './dto/level.dto';

type Meta = { total: number; page: number; limit: number; totalPages: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type SubjectRow = {
  id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  branch_id: string | null;
  tenant_id: string | null;
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
};

type LevelClassRow = {
  level_id: string;
  class_id: string;
};

function mapSubject(row: SubjectRow): SubjectDto {
  return new SubjectDto({
    id: row.id,
    name: row.name,
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
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listSubjects(query: QuerySubjectsDto, branchId: string): Promise<{ data: SubjectDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
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
      data: (data as SubjectRow[]).map(mapSubject),
      meta: { total, page, limit, totalPages },
    };
  }

  async createSubject(
    input: {
      name: string;
      nameAr?: string;
      code?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    branchId: string,
    tenantId: string | null,
  ): Promise<SubjectDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subjects')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        code: input.code ?? null,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);
    return mapSubject(data as SubjectRow);
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
  ): Promise<ClassDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: input.name,
        display_name: input.displayName,
        sort_order: input.sortOrder,
        is_active: input.isActive ?? true,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);
    return mapClass(data as ClassRow);
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
  ): Promise<SectionDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('sections')
      .insert({
        name: input.name,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);
    return mapSection(data as SectionRow);
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

    const { data: level, error } = await supabase
      .from('levels')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        sort_order: input.sortOrder ?? 0,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('*')
      .single();
    throwIfDbError(error);

    const levelRow = level as LevelRow;

    if (input.classIds && input.classIds.length > 0) {
      const payload = input.classIds.map((classId) => ({
        level_id: levelRow.id,
        class_id: classId,
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
}


