import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { ClassSectionDto } from './dto/class-section.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { BulkCreateClassSectionDto } from './dto/bulk-create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';

type ClassSectionRow = {
  id: string;
  class_id: string;
  section_id: string;
  branch_id: string;
  academic_year_id: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  class_teacher_id?: string | null;
};

type ClassSectionWithRelations = ClassSectionRow & {
  classes?: { name: string; display_name: string; sort_order: number } | { name: string; display_name: string; sort_order: number }[] | null;
  sections?: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null;
  staff?: { id: string; user_id: string } | { id: string; user_id: string }[] | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class ClassSectionsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  async listClassSections(
    query: QueryClassSectionsDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<{
    data: ClassSectionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Use provided academicYearId or get active year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('class_sections')
      .select(
        '*, classes:class_id(name, display_name, sort_order), sections:section_id(name, sort_order)',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    if (query.classId) {
      dbQuery = dbQuery.eq('class_id', query.classId);
    }

    if (query.sectionId) {
      dbQuery = dbQuery.eq('section_id', query.sectionId);
    }

    if (query.isActive !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.isActive);
    }

    if (query.classTeacherId) {
      dbQuery = dbQuery.eq('class_teacher_id', query.classTeacherId);
    }

    // Apply sorting
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';
    dbQuery = dbQuery.order(sortBy, { ascending });

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rows = data as ClassSectionWithRelations[];

    let studentCounts = new Map<string, number>();
    let teacherNames = new Map<string, string>();
    if (!query.minimal) {
      studentCounts = await this.getStudentCountsForBranch(
        branchId,
        rows.map((cs) => ({ id: cs.id, class_id: cs.class_id, section_id: cs.section_id })),
      );
      const teacherIds = rows
        .map((cs) => cs.class_teacher_id)
        .filter((id): id is string => !!id);
      teacherNames = await this.getTeacherNames(teacherIds);
    }

    const classSections = rows.map((row) => {
      const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
      const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;

      return new ClassSectionDto({
        id: row.id,
        classId: row.class_id,
        sectionId: row.section_id,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        capacity: row.capacity,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        className: classData?.name,
        classDisplayName: classData?.display_name,
        classSortOrder: classData?.sort_order,
        sectionName: sectionData?.name,
        sectionSortOrder: sectionData?.sort_order,
        studentCount: studentCounts.get(row.id) ?? 0,
        classTeacherId: row.class_teacher_id ?? undefined,
        classTeacherName: row.class_teacher_id ? teacherNames.get(row.class_teacher_id) : undefined,
      });
    });

    return {
      data: classSections,
      meta: { total, page, limit, totalPages },
    };
  }

  async getClassSectionById(id: string, branchId: string): Promise<ClassSectionDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('class_sections')
      .select(
        '*, classes:class_id(name, display_name, sort_order), sections:section_id(name, sort_order), staff:class_teacher_id(id, user_id)',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Class section not found');
    }

    const row = data as ClassSectionWithRelations;
    const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;

    // Get student count
    const studentCount = await this.countStudentsInClassSection(id);

    // Get teacher name if assigned
    let teacherName: string | undefined;
    if (row.class_teacher_id) {
      const teacherNames = await this.getTeacherNames([row.class_teacher_id]);
      teacherName = teacherNames.get(row.class_teacher_id);
    }

    return new ClassSectionDto({
      id: row.id,
      classId: row.class_id,
      sectionId: row.section_id,
      branchId: row.branch_id,
      academicYearId: row.academic_year_id,
      capacity: row.capacity,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      className: classData?.name,
      classDisplayName: classData?.display_name,
      classSortOrder: classData?.sort_order,
      sectionName: sectionData?.name,
      sectionSortOrder: sectionData?.sort_order,
      studentCount,
      classTeacherId: row.class_teacher_id ?? undefined,
      classTeacherName: teacherName,
    });
  }

  async createClassSection(
    input: CreateClassSectionDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<ClassSectionDto> {
    const supabase = this.supabaseConfig.getClient();

    // Use provided academicYearId or get active year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    // Validate class and section exist (they are global, not branch-specific)
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', input.classId)
      .maybeSingle();
    throwIfDbError(classError);
    if (!classData) {
      throw new NotFoundException('Class not found');
    }

    const { data: sectionData, error: sectionError } = await supabase
      .from('sections')
      .select('id')
      .eq('id', input.sectionId)
      .maybeSingle();
    throwIfDbError(sectionError);
    if (!sectionData) {
      throw new NotFoundException('Section not found');
    }

    // Check if combination already exists
    const { data: existing, error: existingError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('class_id', input.classId)
      .eq('section_id', input.sectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (existing) {
      throw new ConflictException(
        'Class-section combination already exists for this academic year',
      );
    }

    const { data, error } = await supabase
      .from('class_sections')
      .insert({
        class_id: input.classId,
        section_id: input.sectionId,
        branch_id: branchId,
        academic_year_id: activeYearId,
        capacity: input.capacity ?? 30,
      })
      .select('*')
      .single();

    throwIfDbError(error);
    return this.getClassSectionById((data as ClassSectionRow).id, branchId);
  }

  async bulkCreateClassSections(
    input: BulkCreateClassSectionDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: ClassSectionDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // 1. Get academic year ONCE
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    // 2. Extract unique class and section IDs from input
    const requestedClassIds = [...new Set(input.classSections.map((cs) => cs.classId))];
    const requestedSectionIds = [...new Set(input.classSections.map((cs) => cs.sectionId))];

    // 3. Batch validate: fetch all requested classes and sections in parallel
    const [classesResult, sectionsResult, existingResult] = await Promise.all([
      supabase.from('classes').select('id').in('id', requestedClassIds),
      supabase.from('sections').select('id').in('id', requestedSectionIds),
      supabase
        .from('class_sections')
        .select('class_id, section_id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', activeYearId),
    ]);

    throwIfDbError(classesResult.error);
    throwIfDbError(sectionsResult.error);
    throwIfDbError(existingResult.error);

    const validClassIds = new Set((classesResult.data || []).map((c) => c.id));
    const validSectionIds = new Set((sectionsResult.data || []).map((s) => s.id));
    const existingCombinations = new Set(
      (existingResult.data || []).map((e) => `${e.class_id}:${e.section_id}`),
    );

    // 4. Filter and validate in memory
    const errors: string[] = [];
    const toInsert: Array<{
      class_id: string;
      section_id: string;
      branch_id: string;
      academic_year_id: string;
      capacity: number;
    }> = [];

    for (const cs of input.classSections) {
      const comboKey = `${cs.classId}:${cs.sectionId}`;

      if (!validClassIds.has(cs.classId)) {
        errors.push(`Class ${cs.classId} not found`);
        continue;
      }
      if (!validSectionIds.has(cs.sectionId)) {
        errors.push(`Section ${cs.sectionId} not found`);
        continue;
      }
      if (existingCombinations.has(comboKey)) {
        // Skip duplicates silently (they already exist)
        continue;
      }

      toInsert.push({
        class_id: cs.classId,
        section_id: cs.sectionId,
        branch_id: branchId,
        academic_year_id: activeYearId,
        capacity: cs.capacity ?? 30,
      });
    }

    if (toInsert.length === 0) {
      if (errors.length > 0) {
        throw new BadRequestException(`Failed to create class sections: ${errors.join('; ')}`);
      }
      // All requested combinations already exist
      return { data: [] };
    }

    // 5. Batch insert all at once
    const { data: insertedRows, error: insertError } = await supabase
      .from('class_sections')
      .insert(toInsert)
      .select('id, class_id, section_id, branch_id, academic_year_id, capacity, is_active, created_at, updated_at');

    throwIfDbError(insertError);

    if (!insertedRows || insertedRows.length === 0) {
      throw new BadRequestException('Failed to insert class sections');
    }

    // 6. Batch hydrate: fetch class and section names for all inserted rows
    const insertedClassIds = [...new Set(insertedRows.map((r) => r.class_id))];
    const insertedSectionIds = [...new Set(insertedRows.map((r) => r.section_id))];

    const [classNamesResult, sectionNamesResult] = await Promise.all([
      supabase.from('classes').select('id, name, display_name').in('id', insertedClassIds),
      supabase.from('sections').select('id, name').in('id', insertedSectionIds),
    ]);

    const classMap = new Map(
      (classNamesResult.data || []).map((c) => [c.id, { name: c.name, displayName: c.display_name }]),
    );
    const sectionMap = new Map(
      (sectionNamesResult.data || []).map((s) => [s.id, s.name]),
    );

    // 7. Build DTOs without additional queries (no student counts needed for new sections)
    const results = insertedRows.map((row) => {
      const classInfo = classMap.get(row.class_id);
      const sectionName = sectionMap.get(row.section_id);

      return new ClassSectionDto({
        id: row.id,
        classId: row.class_id,
        sectionId: row.section_id,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        capacity: row.capacity,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        className: classInfo?.name,
        classDisplayName: classInfo?.displayName,
        sectionName: sectionName,
        studentCount: 0, // New sections have 0 students
        classTeacherId: undefined,
        classTeacherName: undefined,
      });
    });

    return { data: results };
  }

  async updateClassSection(
    id: string,
    input: UpdateClassSectionDto,
    branchId: string,
  ): Promise<ClassSectionDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify it exists and belongs to branch
    const existing = await this.getClassSectionById(id, branchId);

    const updateData: Partial<ClassSectionRow> = {};
    if (input.capacity !== undefined) {
      updateData.capacity = input.capacity;
    }
    if (input.isActive !== undefined) {
      updateData.is_active = input.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const { data, error } = await supabase
      .from('class_sections')
      .update(updateData)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .single();

    throwIfDbError(error);
    return this.getClassSectionById((data as ClassSectionRow).id, branchId);
  }

  async deleteClassSection(id: string, branchId: string): Promise<void> {
    // Verify it exists and belongs to branch
    await this.getClassSectionById(id, branchId);

    // Check if students are enrolled
    const studentCount = await this.countStudentsInClassSection(id);
    if (studentCount > 0) {
      throw new BadRequestException(
        `Cannot delete class-section with ${studentCount} enrolled student(s)`,
      );
    }

    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase
      .from('class_sections')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    throwIfDbError(error);
  }

  async getStudentsInClassSection(
    id: string,
    branchId: string,
  ): Promise<{ data: Array<{ id: string; studentId: string; fullName: string }> }> {
    // Verify class-section exists
    await this.getClassSectionById(id, branchId);

    const supabase = this.supabaseConfig.getClient();

    // Get class-section details to find class_id and section_id
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class section not found');
    }

    const cs = classSection as { class_id: string; section_id: string };

    // Get students in this class-section
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, student_id, user_id')
      .eq('branch_id', branchId)
      .eq('class_id', cs.class_id)
      .eq('section_id', cs.section_id)
      .eq('is_active', true);

    throwIfDbError(studentsError);

    // Get user IDs and fetch profiles
    const userIds = (students || [])
      .map((s) => (s as { user_id: string }).user_id)
      .filter((id): id is string => !!id);

    const { data: profiles } = userIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)
      : { data: [] };

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p.full_name]),
    );

    const studentList = (students || []).map((s) => {
      const student = s as { id: string; student_id: string; user_id: string };
      return {
        id: student.id,
        studentId: student.student_id,
        fullName: profileMap.get(student.user_id) || '',
      };
    });

    return { data: studentList };
  }

  async countStudentsInClassSection(id: string): Promise<number> {
    const supabase = this.supabaseConfig.getClient();

    // Get class-section details
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('class_id, section_id, branch_id')
      .eq('id', id)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      return 0;
    }

    const cs = classSection as { class_id: string; section_id: string; branch_id: string };

    // Count students
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', cs.branch_id)
      .eq('class_id', cs.class_id)
      .eq('section_id', cs.section_id)
      .eq('is_active', true);

    throwIfDbError(error);
    return count ?? 0;
  }

  /**
   * Get student counts for the given class sections in one query (avoids N+1).
   * Fetches (class_id, section_id) for all active students in the branch, then aggregates in memory.
   */
  private async getStudentCountsForBranch(
    branchId: string,
    classSections: Array<{ id: string; class_id: string; section_id: string }>,
  ): Promise<Map<string, number>> {
    if (classSections.length === 0) {
      return new Map();
    }

    const supabase = this.supabaseConfig.getClient();

    const { data: students, error } = await supabase
      .from('students')
      .select('class_id, section_id')
      .eq('branch_id', branchId)
      .eq('is_active', true);
    throwIfDbError(error);

    const countByClassSection = new Map<string, number>();
    for (const cs of classSections) {
      countByClassSection.set(cs.id, 0);
    }
    const key = (c: string, s: string) => `${c}:${s}`;
    const runningCount = new Map<string, number>();
    for (const row of (students || []) as Array<{ class_id: string; section_id: string }>) {
      const k = key(row.class_id, row.section_id);
      runningCount.set(k, (runningCount.get(k) ?? 0) + 1);
    }
    for (const cs of classSections) {
      const k = key(cs.class_id, cs.section_id);
      countByClassSection.set(cs.id, runningCount.get(k) ?? 0);
    }
    return countByClassSection;
  }

  private async getTeacherNames(staffIds: string[]): Promise<Map<string, string>> {
    if (staffIds.length === 0) {
      return new Map();
    }

    const supabase = this.supabaseConfig.getClient();

    // Get staff with user_ids
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, user_id')
      .in('id', staffIds);
    throwIfDbError(staffError);

    const userIds = (staff || [])
      .map((s) => (s as { user_id: string }).user_id)
      .filter((id): id is string => !!id);

    if (userIds.length === 0) {
      return new Map();
    }

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p.full_name]),
    );

    // Map staff_id -> teacher name
    const teacherMap = new Map<string, string>();
    for (const s of (staff || []) as Array<{ id: string; user_id: string }>) {
      const name = profileMap.get(s.user_id);
      if (name) {
        teacherMap.set(s.id, name);
      }
    }

    return teacherMap;
  }

  async assignClassTeacher(
    classSectionId: string,
    staffId: string | null,
    branchId: string,
  ): Promise<ClassSectionDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify class-section exists
    await this.getClassSectionById(classSectionId, branchId);

    // If assigning a teacher, verify staff exists and belongs to branch
    if (staffId) {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('id', staffId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(staffError);
      if (!staff) {
        throw new NotFoundException('Staff member not found or does not belong to this branch');
      }
    }

    const { data, error } = await supabase
      .from('class_sections')
      .update({ class_teacher_id: staffId })
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .select('*')
      .single();

    throwIfDbError(error);
    return this.getClassSectionById((data as ClassSectionRow).id, branchId);
  }
}

