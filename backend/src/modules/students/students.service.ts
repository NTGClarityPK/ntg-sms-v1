import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { StudentDto } from './dto/student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';

type StudentRow = {
  id: string;
  user_id: string;
  branch_id: string;
  student_id: string;
  class_id: string | null;
  section_id: string | null;
  blood_group: string | null;
  medical_notes: string | null;
  admission_date: string | null;
  academic_year_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  async listStudents(
    query: QueryStudentsDto,
    branchId: string,
    userId: string,
    userRoles?: string[],
  ): Promise<{
    data: StudentDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Check if user is parent/guardian - filter to only their children
    const isParent = userRoles?.some((r) => ['parent', 'guardian'].includes(r.toLowerCase()));
    let allowedStudentIds: string[] | null = null;

    if (isParent) {
      const { data: parentStudents } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id', userId);
      allowedStudentIds = (parentStudents || []).map((ps) => ps.student_id as string);
      if (allowedStudentIds.length === 0) {
        // Parent has no children - return empty result
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
    }

    let dbQuery = supabase
      .from('students')
      .select(
        '*, classes:class_id(name, display_name), sections:section_id(name)',
        { count: 'exact' },
      )
      .eq('branch_id', branchId);

    // Filter by allowed student IDs if parent/guardian
    if (allowedStudentIds) {
      dbQuery = dbQuery.in('id', allowedStudentIds);
    }

    // Support both single (backward compatibility) and multiple filters
    if (query.classIds && query.classIds.length > 0) {
      dbQuery = dbQuery.in('class_id', query.classIds);
    } else if (query.classId) {
      dbQuery = dbQuery.eq('class_id', query.classId);
    }

    if (query.sectionIds && query.sectionIds.length > 0) {
      dbQuery = dbQuery.in('section_id', query.sectionIds);
    } else if (query.sectionId) {
      dbQuery = dbQuery.eq('section_id', query.sectionId);
    }

    if (query.isActive !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.isActive);
    }

    // Apply sorting
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';
    
    // Map frontend sortBy to database columns
    const sortColumnMap: Record<string, string> = {
      studentId: 'student_id',
      fullName: 'first_name',
      firstName: 'first_name',
      lastName: 'last_name',
      className: 'class_id',
      sectionName: 'section_id',
      isActive: 'is_active',
      createdAt: 'created_at',
      created_at: 'created_at',
    };

    const dbSortColumn = sortColumnMap[sortBy] || 'created_at';
    dbQuery = dbQuery.order(dbSortColumn, { ascending });

    // Search: by student_id, first_name, last_name (DB filter for name; client-side for student_id + email)
    const searchTerms = (query.search ?? '')
      .trim()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const hasSearch = searchTerms.length > 0;
    if (hasSearch) {
      const nameOrFilter = searchTerms
        .map((t) => `first_name.ilike.%${t}%,last_name.ilike.%${t}%`)
        .join(',');
      dbQuery = dbQuery.or(nameOrFilter);
    }

    const fetchLimit = hasSearch ? 1000 : limit;
    const fetchTo = hasSearch ? from + fetchLimit - 1 : to;
    let dbQueryWithLimit = dbQuery.range(from, fetchTo);

    const { data, error, count } = await dbQueryWithLimit;

    throwIfDbError(error);

    const userIds = (data as unknown as Array<{ user_id: string }>)
      .map((s) => s.user_id)
      .filter((id): id is string => !!id);

    // OPTIMISED: Fetch emails only for needed users via batched individual lookups
    // (instead of fetching ALL auth users and filtering client-side)
    const emailPromises = userIds.map((id) =>
      supabase.auth.admin.getUserById(id).then((res) => [id, res.data.user?.email || ''] as const),
    );
    const emailEntries = await Promise.all(emailPromises);
    const emailMap = new Map(emailEntries);

    // Fetch subject template assignments for all students
    const studentIds = (data as unknown as Array<{ id: string }>)
      .map((s) => s.id)
      .filter((id): id is string => !!id);

    const { data: templateAssignments } = studentIds.length > 0
      ? await supabase
          .from('student_subject_template_assignments')
          .select('student_id, subject_template_id, subject_templates:subject_template_id(name)')
          .in('student_id', studentIds)
      : { data: [] };

    // Create map: student_id -> { templateId, templateName }
    const templateMap = new Map(
      (templateAssignments || []).map((ta: {
        student_id: string;
        subject_template_id: string;
        subject_templates: { name: string } | { name: string }[] | null;
      }) => {
        const templateData = Array.isArray(ta.subject_templates) 
          ? ta.subject_templates[0] 
          : ta.subject_templates;
        return [
          ta.student_id,
          {
            templateId: ta.subject_template_id,
            templateName: templateData?.name,
          },
        ];
      }),
    );

    const students = (data as unknown as Array<{
      id: string;
      user_id: string;
      branch_id: string;
      student_id: string;
      class_id: string | null;
      section_id: string | null;
      blood_group: string | null;
      medical_notes: string | null;
      admission_date: string | null;
      academic_year_id: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      first_name: string | null;
      last_name: string | null;
      classes: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    }>).map((row) => {
      const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
      const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;
      const templateInfo = templateMap.get(row.id);

      return new StudentDto({
        id: row.id,
        userId: row.user_id,
        branchId: row.branch_id,
        studentId: row.student_id,
        classId: row.class_id ?? undefined,
        sectionId: row.section_id ?? undefined,
        bloodGroup: row.blood_group ?? undefined,
        medicalNotes: row.medical_notes ?? undefined,
        admissionDate: row.admission_date ?? undefined,
        academicYearId: row.academic_year_id ?? undefined,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        email: emailMap.get(row.user_id),
        className: classData?.display_name ?? classData?.name,
        sectionName: sectionData?.name,
        subjectTemplateId: templateInfo?.templateId,
        subjectTemplateName: templateInfo?.templateName,
      });
    });

    // Apply search filter on student_id and email when searching (name already filtered in DB)
    let filteredStudents = students;
    if (hasSearch) {
      const termsLower = searchTerms.map((t) => t.toLowerCase());
      filteredStudents = students.filter((s) =>
        termsLower.some(
          (term) =>
            s.studentId.toLowerCase().includes(term) ||
            [s.firstName ?? '', s.lastName ?? ''].some((n) => n.toLowerCase().includes(term)) ||
            (s.email?.toLowerCase().includes(term) ?? false),
        ),
      );
    }

    const total = hasSearch ? filteredStudents.length : (count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginatedData = hasSearch ? filteredStudents.slice(from, from + limit) : filteredStudents;

    return {
      data: paginatedData,
      meta: { total, page, limit, totalPages },
    };
  }

  async getStudentById(id: string, branchId: string): Promise<StudentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('students')
      .select(
        '*, classes:class_id(name, display_name), sections:section_id(name)',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Student not found');
    }

    const row = data as unknown as {
      id: string;
      user_id: string;
      branch_id: string;
      student_id: string;
      class_id: string | null;
      section_id: string | null;
      blood_group: string | null;
      medical_notes: string | null;
      admission_date: string | null;
      academic_year_id: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      first_name: string | null;
      last_name: string | null;
      classes: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    };

    const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;

    const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);

    const { data: templateAssignment } = await supabase
      .from('student_subject_template_assignments')
      .select('subject_template_id, subject_templates:subject_template_id(name)')
      .eq('student_id', id)
      .maybeSingle();

    const templateData = Array.isArray(templateAssignment?.subject_templates)
      ? templateAssignment?.subject_templates[0]
      : templateAssignment?.subject_templates;

    return new StudentDto({
      id: row.id,
      userId: row.user_id,
      branchId: row.branch_id,
      studentId: row.student_id,
      classId: row.class_id ?? undefined,
      sectionId: row.section_id ?? undefined,
      bloodGroup: row.blood_group ?? undefined,
      medicalNotes: row.medical_notes ?? undefined,
      admissionDate: row.admission_date ?? undefined,
      academicYearId: row.academic_year_id ?? undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      email: authUser.user?.email,
      className: classData?.display_name ?? classData?.name,
      sectionName: sectionData?.name,
      subjectTemplateId: templateAssignment?.subject_template_id,
      subjectTemplateName: templateData?.name,
    });
  }

  async createStudent(input: CreateStudentDto, branchId: string, userEmail: string): Promise<StudentDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    // Get active academic year if not provided.
    // Fresh tenants may not have one configured yet; allow creating a student without it.
    let academicYearId: string | null = input.academicYearId ?? null;
    if (!academicYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      academicYearId = activeYear?.id ?? null;
    }

    // Create auth user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictException('User with this email already exists');
      }
      throw new BadRequestException(authError.message);
    }

    if (!user) {
      throw new BadRequestException('Failed to create user');
    }

    const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

    try {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: displayName,
        avatar_url: input.avatarUrl ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        date_of_birth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        is_active: input.isActive ?? true,
        created_by: username,
        updated_by: username,
      });

      throwIfDbError(profileError);

      // Assign to branch
      const { error: branchError } = await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branchId,
        is_primary: false,
        created_by: username,
      });

      if (branchError) {
        throw new BadRequestException(branchError.message);
      }

      // Assign student role
      const { data: studentRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'student')
        .single();

      if (studentRole) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: studentRole.id,
          branch_id: branchId,
          created_by: username,
        });
      }

      // Generate a roll number in-app (do not rely on triggers existing in every environment).
      // If RPC fails for any reason, we fall back to DB trigger/default behaviour.
      let generatedStudentId: string | null = null;
      const { data: rollData, error: rollError } = await supabase.rpc('next_student_roll');
      if (!rollError && typeof rollData === 'string' && rollData.trim() !== '') {
        generatedStudentId = rollData.trim();
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: user.id,
          branch_id: branchId,
          student_id: generatedStudentId ?? undefined,
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          class_id: input.classId ?? null,
          section_id: input.sectionId ?? null,
          blood_group: input.bloodGroup ?? null,
          medical_notes: input.medicalNotes ?? null,
          admission_date: input.admissionDate ?? null,
          academic_year_id: academicYearId,
          is_active: input.isActive ?? true,
          created_by: username,
          updated_by: username,
        })
        .select()
        .single();

      if (studentError) {
        // Provide a clear message for QA + users when unique constraints are hit.
        if (studentError.code === '23505' && studentError.message.includes('students_student_id_key')) {
          throw new ConflictException(
            'Student ID already exists. Please try again.',
          );
        }
        throwIfDbError(studentError);
      }
      if (!student) {
        throw new BadRequestException('Failed to create student record');
      }

      const studentRow = student as StudentRow;
      this.auditLogService
        .logCreate('students', studentRow.id, userEmail, { ...studentRow } as Record<string, unknown>, {
          branchId,
        })
        .catch(() => {});

      // Create subject template assignment if provided (requires an academic year).
      if (input.subjectTemplateId) {
        if (!academicYearId) {
          throw new BadRequestException(
            'Cannot assign subject template: No active academic year found. Please set an academic year in Settings.',
          );
        }
        const { error: assignmentError } = await supabase
          .from('student_subject_template_assignments')
          .upsert(
            {
              student_id: studentRow.id,
              subject_template_id: input.subjectTemplateId,
              academic_year_id: academicYearId,
              branch_id: branchId,
              created_by: username,
              updated_by: username,
            },
            {
              onConflict: 'student_id,academic_year_id',
            },
          );
        throwIfDbError(assignmentError);
      }

      return this.getStudentById(studentRow.id, branchId);
    } catch (error) {
      // Rollback: delete auth user if student creation fails
      await supabase.auth.admin.deleteUser(user.id);
      throw error;
    }
  }

  async updateStudent(
    id: string,
    input: UpdateStudentDto,
    branchId: string,
    userEmail: string,
  ): Promise<StudentDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    const { data: oldRow, error: fetchError } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(fetchError);
    if (!oldRow) {
      throw new NotFoundException('Student not found');
    }

    const oldRowWithName = oldRow as { first_name?: string | null; last_name?: string | null; user_id: string };
    const newFirst = input.firstName !== undefined ? input.firstName.trim() : (oldRowWithName.first_name ?? '');
    const newLast = input.lastName !== undefined ? input.lastName.trim() : (oldRowWithName.last_name ?? '');
    const displayName = `${newFirst} ${newLast}`.trim();

    if (displayName || input.phone !== undefined || input.address !== undefined || input.dateOfBirth !== undefined || input.gender !== undefined) {
      const { data: student } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', id)
        .single();

      if (student) {
        const profilePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          updated_by: username,
        };
        if ((input.firstName !== undefined || input.lastName !== undefined) && displayName) profilePayload.full_name = displayName;
        if (input.phone !== undefined) profilePayload.phone = input.phone;
        if (input.address !== undefined) profilePayload.address = input.address;
        if (input.dateOfBirth !== undefined) profilePayload.date_of_birth = input.dateOfBirth ?? null;
        if (input.gender !== undefined) profilePayload.gender = input.gender ?? null;

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', (student as { user_id: string }).user_id);

        throwIfDbError(profileError);
      }
    }

    // Get student's academic year for template assignment
    const { data: studentData } = await supabase
      .from('students')
      .select('academic_year_id')
      .eq('id', id)
      .single();

    const updatePayload: {
      first_name?: string;
      last_name?: string;
      class_id?: string;
      section_id?: string;
      blood_group?: string | null;
      medical_notes?: string | null;
      admission_date?: string | null;
      is_active?: boolean;
      updated_at: string;
      updated_by: string;
      academic_year_id?: string | null;
    } = {
      class_id: input.classId ?? undefined,
      section_id: input.sectionId ?? undefined,
      blood_group: input.bloodGroup,
      medical_notes: input.medicalNotes,
      admission_date: input.admissionDate,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
      updated_by: username,
    };
    if (input.firstName !== undefined) updatePayload.first_name = input.firstName.trim();
    if (input.lastName !== undefined) updatePayload.last_name = input.lastName.trim();

    // Update academic_year_id if provided
    if (input.academicYearId !== undefined) {
      updatePayload.academic_year_id = input.academicYearId ?? null;
    }

    const filteredPayload = Object.fromEntries(
      Object.entries(updatePayload).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>;
    const { data: newRow, error } = await supabase
      .from('students')
      .update(filteredPayload)
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);

    if (newRow) {
      const changedFields = Object.keys(filteredPayload).filter((k) => k !== 'updated_at');
      this.auditLogService
        .logUpdate(
          'students',
          id,
          userEmail,
          { ...oldRow } as Record<string, unknown>,
          { ...newRow } as Record<string, unknown>,
          changedFields,
          { branchId },
        )
        .catch(() => {});
    }

    // Determine academic year to use for template assignment
    // Priority: input.academicYearId > existing student.academic_year_id
    const academicYearIdForTemplate =
      input.academicYearId ?? studentData?.academic_year_id ?? null;

    // Update subject template assignment if provided
    if (input.subjectTemplateId !== undefined) {
      if (!academicYearIdForTemplate) {
        throw new BadRequestException(
          'Cannot assign subject template: Student must have an academic year assigned.',
        );
      }

      if (input.subjectTemplateId) {
        // Upsert assignment
        const { error: assignmentError } = await supabase
          .from('student_subject_template_assignments')
          .upsert(
            {
              student_id: id,
              subject_template_id: input.subjectTemplateId,
              academic_year_id: academicYearIdForTemplate,
              branch_id: branchId,
              created_by: username,
              updated_by: username,
            },
            {
              onConflict: 'student_id,academic_year_id',
            },
          );
        throwIfDbError(assignmentError);
      } else {
        // Remove assignment if set to null/empty
        const { error: deleteError } = await supabase
          .from('student_subject_template_assignments')
          .delete()
          .eq('student_id', id)
          .eq('academic_year_id', academicYearIdForTemplate)
          .eq('branch_id', branchId);
        throwIfDbError(deleteError);
      }
    }

    return this.getStudentById(id, branchId);
  }

  async bulkImport(
    students: CreateStudentDto[],
    branchId: string,
    userEmail: string,
  ): Promise<{ success: number; errors: Array<{ row: number; error: string }> }> {
    const results = { success: 0, errors: [] as Array<{ row: number; error: string }> };

    for (let i = 0; i < students.length; i++) {
      try {
        await this.createStudent(students[i], branchId, userEmail);
        results.success++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        results.errors.push({ row: i + 1, error: errorMessage });
      }
    }

    return results;
  }
}

