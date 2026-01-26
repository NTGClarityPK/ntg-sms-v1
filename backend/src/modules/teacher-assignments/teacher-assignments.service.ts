import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { TeacherAssignmentDto } from './dto/teacher-assignment.dto';
import { QueryTeacherAssignmentsDto } from './dto/query-teacher-assignments.dto';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';

type TeacherAssignmentRow = {
  id: string;
  staff_id: string;
  subject_id: string;
  class_section_id: string;
  academic_year_id: string;
  branch_id: string;
  created_at: string;
};

type TeacherAssignmentWithRelations = TeacherAssignmentRow & {
  staff?: { id: string; user_id: string } | { id: string; user_id: string }[] | null;
  subjects?: { name: string } | { name: string }[] | null;
  class_sections?: {
    id: string;
    class_id: string;
    section_id: string;
  } | {
    id: string;
    class_id: string;
    section_id: string;
  }[] | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  async listTeacherAssignments(
    query: QueryTeacherAssignmentsDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<{
    data: TeacherAssignmentDto[];
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
      .from('teacher_assignments')
      .select(
        '*, staff:staff_id(id, user_id), subjects:subject_id(name), class_sections:class_section_id(id, class_id, section_id)',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    if (query.staffId) {
      dbQuery = dbQuery.eq('staff_id', query.staffId);
    }

    if (query.subjectId) {
      dbQuery = dbQuery.eq('subject_id', query.subjectId);
    }

    if (query.classSectionId) {
      dbQuery = dbQuery.eq('class_section_id', query.classSectionId);
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

    // Get staff names and class-section details
    const staffIds = (data as TeacherAssignmentWithRelations[])
      .map((ta) => ta.staff_id)
      .filter((id, index, arr) => arr.indexOf(id) === index);
    const staffNames = await this.getStaffNames(staffIds);

    // Get class and section names
    const classSectionIds = (data as TeacherAssignmentWithRelations[])
      .map((ta) => ta.class_section_id)
      .filter((id, index, arr) => arr.indexOf(id) === index);
    const classSectionDetails = await this.getClassSectionDetails(classSectionIds);

    const assignments = (data as TeacherAssignmentWithRelations[]).map((row) => {
      const subjectData = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const classSectionData = Array.isArray(row.class_sections)
        ? row.class_sections[0]
        : row.class_sections;

      const csDetails = classSectionDetails.get(row.class_section_id);

      return new TeacherAssignmentDto({
        id: row.id,
        staffId: row.staff_id,
        subjectId: row.subject_id,
        classSectionId: row.class_section_id,
        academicYearId: row.academic_year_id,
        branchId: row.branch_id,
        createdAt: row.created_at,
        staffName: staffNames.get(row.staff_id),
        subjectName: subjectData?.name,
        className: csDetails?.className,
        sectionName: csDetails?.sectionName,
        classSectionName: csDetails
          ? `${csDetails.className} - ${csDetails.sectionName}`
          : undefined,
      });
    });

    return {
      data: assignments,
      meta: { total, page, limit, totalPages },
    };
  }

  async getTeacherAssignmentById(id: string, branchId: string): Promise<TeacherAssignmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('teacher_assignments')
      .select(
        '*, staff:staff_id(id, user_id), subjects:subject_id(name), class_sections:class_section_id(id, class_id, section_id)',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Teacher assignment not found');
    }

    const row = data as TeacherAssignmentWithRelations;
    const subjectData = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;

    // Get staff name
    const staffNames = await this.getStaffNames([row.staff_id]);
    const staffName = staffNames.get(row.staff_id);

    // Get class-section details
    const classSectionDetails = await this.getClassSectionDetails([row.class_section_id]);
    const csDetails = classSectionDetails.get(row.class_section_id);

    return new TeacherAssignmentDto({
      id: row.id,
      staffId: row.staff_id,
      subjectId: row.subject_id,
      classSectionId: row.class_section_id,
      academicYearId: row.academic_year_id,
      branchId: row.branch_id,
      createdAt: row.created_at,
      staffName,
      subjectName: subjectData?.name,
      className: csDetails?.className,
      sectionName: csDetails?.sectionName,
      classSectionName: csDetails
        ? `${csDetails.className} - ${csDetails.sectionName}`
        : undefined,
    });
  }

  async createTeacherAssignment(
    input: CreateTeacherAssignmentDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<TeacherAssignmentDto> {
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

    // Validate staff, subject, and class-section belong to the branch
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('id', input.staffId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(staffError);
    if (!staffData) {
      throw new NotFoundException('Staff member not found or does not belong to this branch');
    }

    const { data: subjectData, error: subjectError } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', input.subjectId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(subjectError);
    if (!subjectData) {
      throw new NotFoundException('Subject not found or does not belong to this branch');
    }

    const { data: classSectionData, error: classSectionError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('id', input.classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(classSectionError);
    if (!classSectionData) {
      throw new NotFoundException('Class section not found or does not belong to this branch');
    }

    // Check if assignment already exists (unique constraint)
    const { data: existing, error: existingError } = await supabase
      .from('teacher_assignments')
      .select('id')
      .eq('subject_id', input.subjectId)
      .eq('class_section_id', input.classSectionId)
      .eq('academic_year_id', activeYearId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (existing) {
      throw new ConflictException(
        'Teacher assignment already exists for this subject-class-section combination',
      );
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .insert({
        staff_id: input.staffId,
        subject_id: input.subjectId,
        class_section_id: input.classSectionId,
        academic_year_id: activeYearId,
        branch_id: branchId,
      })
      .select('*')
      .single();

    throwIfDbError(error);
    return this.getTeacherAssignmentById((data as TeacherAssignmentRow).id, branchId);
  }

  async updateTeacherAssignment(
    id: string,
    input: UpdateTeacherAssignmentDto,
    branchId: string,
  ): Promise<TeacherAssignmentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify it exists and belongs to branch
    const existing = await this.getTeacherAssignmentById(id, branchId);

    // Validate new staff belongs to branch
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('id', input.staffId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(staffError);
    if (!staffData) {
      throw new NotFoundException('Staff member not found or does not belong to this branch');
    }

    const { data, error } = await supabase
      .from('teacher_assignments')
      .update({ staff_id: input.staffId })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .single();

    throwIfDbError(error);
    return this.getTeacherAssignmentById((data as TeacherAssignmentRow).id, branchId);
  }

  async deleteTeacherAssignment(id: string, branchId: string): Promise<void> {
    // Verify it exists and belongs to branch
    await this.getTeacherAssignmentById(id, branchId);

    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    throwIfDbError(error);
  }

  async getAssignmentsByTeacher(
    staffId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: TeacherAssignmentDto[] }> {
    const query: QueryTeacherAssignmentsDto = {
      staffId,
      page: 1,
      limit: 1000,
      sortOrder: 'desc',
    };
    const result = await this.listTeacherAssignments(query, branchId, academicYearId);
    return { data: result.data };
  }

  async getAssignmentsByClassSection(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: TeacherAssignmentDto[] }> {
    const query: QueryTeacherAssignmentsDto = {
      classSectionId,
      page: 1,
      limit: 1000,
      sortOrder: 'desc',
    };
    const result = await this.listTeacherAssignments(query, branchId, academicYearId);
    return { data: result.data };
  }

  private async getStaffNames(staffIds: string[]): Promise<Map<string, string>> {
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

  private async getClassSectionDetails(
    classSectionIds: string[],
  ): Promise<
    Map<
      string,
      {
        className: string;
        sectionName: string;
      }
    >
  > {
    if (classSectionIds.length === 0) {
      return new Map();
    }

    const supabase = this.supabaseConfig.getClient();

    // Get class-sections with class and section details
    const { data: classSections, error: csError } = await supabase
      .from('class_sections')
      .select(
        'id, class_id, section_id, classes:class_id(name, display_name), sections:section_id(name)',
      )
      .in('id', classSectionIds);
    throwIfDbError(csError);

    const detailsMap = new Map<
      string,
      {
        className: string;
        sectionName: string;
      }
    >();

    for (const cs of (classSections || []) as Array<{
      id: string;
      class_id: string;
      section_id: string;
      classes?: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections?: { name: string } | { name: string }[] | null;
    }>) {
      const classData = Array.isArray(cs.classes) ? cs.classes[0] : cs.classes;
      const sectionData = Array.isArray(cs.sections) ? cs.sections[0] : cs.sections;

      detailsMap.set(cs.id, {
        className: classData?.display_name || classData?.name || 'Unknown',
        sectionName: sectionData?.name || 'Unknown',
      });
    }

    return detailsMap;
  }
}

