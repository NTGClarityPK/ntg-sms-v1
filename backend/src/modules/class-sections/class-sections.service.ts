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
  classes?: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
  sections?: { name: string } | { name: string }[] | null;
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
      const activeYear = await this.academicYearsService.getActive();
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
        '*, classes:class_id(name, display_name), sections:section_id(name)',
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

    // Apply sorting
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';
    dbQuery = dbQuery.order(sortBy, { ascending });

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Get student counts for each class-section
    const classSectionIds = (data as ClassSectionWithRelations[]).map((cs) => cs.id);
    const studentCounts = await this.getStudentCounts(classSectionIds);

    // Get class teacher names if class_teacher_id exists
    const teacherIds = (data as ClassSectionWithRelations[])
      .map((cs) => cs.class_teacher_id)
      .filter((id): id is string => !!id);
    const teacherNames = await this.getTeacherNames(teacherIds);

    const classSections = (data as ClassSectionWithRelations[]).map((row) => {
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
        sectionName: sectionData?.name,
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
        '*, classes:class_id(name, display_name), sections:section_id(name), staff:class_teacher_id(id, user_id)',
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
      sectionName: sectionData?.name,
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
      const activeYear = await this.academicYearsService.getActive();
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
        capacity: input.capacity,
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
    // Use provided academicYearId or get active year
    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActive();
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    const results: ClassSectionDto[] = [];
    const errors: string[] = [];

    for (const classSection of input.classSections) {
      try {
        const created = await this.createClassSection(classSection, branchId, activeYearId);
        results.push(created);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(
          `Class ${classSection.classId} - Section ${classSection.sectionId}: ${errorMessage}`,
        );
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new BadRequestException(`Failed to create class sections: ${errors.join('; ')}`);
    }

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

  private async getStudentCounts(classSectionIds: string[]): Promise<Map<string, number>> {
    if (classSectionIds.length === 0) {
      return new Map();
    }

    const supabase = this.supabaseConfig.getClient();

    // Get all class-sections with their class_id, section_id, branch_id
    const { data: classSections, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id, branch_id')
      .in('id', classSectionIds);
    throwIfDbError(csError);

    const counts = new Map<string, number>();

    // For each class-section, count students
    for (const cs of (classSections || []) as Array<{
      id: string;
      class_id: string;
      section_id: string;
      branch_id: string;
    }>) {
      const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', cs.branch_id)
        .eq('class_id', cs.class_id)
        .eq('section_id', cs.section_id)
        .eq('is_active', true);
      throwIfDbError(error);
      counts.set(cs.id, count ?? 0);
    }

    return counts;
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

