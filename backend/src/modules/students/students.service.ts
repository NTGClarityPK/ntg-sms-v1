import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { StudentDto } from './dto/student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { GenerateStudentIdDto } from './dto/generate-student-id.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';

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
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  async listStudents(query: QueryStudentsDto, branchId: string): Promise<{
    data: StudentDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('students')
      .select(
        '*, classes:class_id(name, display_name), sections:section_id(name)',
        { count: 'exact' },
      )
      .eq('branch_id', branchId);

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
      className: 'class_id',
      sectionName: 'section_id',
      isActive: 'is_active',
      createdAt: 'created_at',
      created_at: 'created_at',
    };
    
    const dbSortColumn = sortColumnMap[sortBy] || 'created_at';
    dbQuery = dbQuery.order(dbSortColumn, { ascending });

    // Don't filter by student_id in DB query when searching - we'll filter by name client-side
    // This allows searching by both student_id and full_name
    // Note: We fetch more records than needed when searching, then filter client-side
    const searchQuery = query.search;
    const fetchLimit = searchQuery ? 1000 : limit; // Fetch more when searching to allow client-side filtering
    const fetchTo = searchQuery ? from + fetchLimit - 1 : to;

    let dbQueryWithLimit = dbQuery.range(from, fetchTo);

    const { data, error, count } = await dbQueryWithLimit;

    throwIfDbError(error);

    // Get user IDs and fetch profiles separately
    const userIds = (data as unknown as Array<{ user_id: string }>)
      .map((s) => s.user_id)
      .filter((id): id is string => !!id);

    // Fetch profiles - if searching, also filter by full_name in DB
    let profilesQuery = supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (searchQuery && userIds.length > 0) {
      // Filter profiles by full_name in database for better performance
      profilesQuery = profilesQuery.ilike('full_name', `%${searchQuery}%`);
    }

    const { data: profilesData } = userIds.length > 0
      ? await profilesQuery
      : { data: [] };

    const profileMap = new Map(
      (profilesData || []).map((p) => [p.id, p.full_name]),
    );

    // Get user emails
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(
      authUsers.users
        .filter((u) => userIds.includes(u.id))
        .map((u) => [u.id, u.email || '']),
    );

    let students = (data as unknown as Array<{
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
      classes: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    }>)
      .filter((row) => {
        // Filter by profile match when searching (profiles already filtered in DB)
        if (searchQuery && !profileMap.has(row.user_id)) {
          return false;
        }
        return true;
      })
      .map((row) => {
        const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
        const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;
        const fullName = profileMap.get(row.user_id);

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
          fullName: fullName,
          email: emailMap.get(row.user_id),
          className: classData?.display_name ?? classData?.name,
          sectionName: sectionData?.name,
        });
      });

    // Apply search filter on student_id and full_name (case-insensitive)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      students = students.filter(
        (s) =>
          s.studentId.toLowerCase().includes(searchLower) ||
          s.fullName?.toLowerCase().includes(searchLower) ||
          s.email?.toLowerCase().includes(searchLower),
      );
    }

    // Calculate total and pagination
    // When searching, total is the filtered count; otherwise use DB count
    const total = searchQuery ? students.length : (count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Apply pagination to filtered results when searching
    if (searchQuery) {
      students = students.slice(from, from + limit);
    }

    return {
      data: students,
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
      classes: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    };

    // Fetch profile separately
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', row.user_id)
      .single();

    const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;

    const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);

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
      fullName: profile?.full_name,
      email: authUser.user?.email,
      className: classData?.display_name ?? classData?.name,
      sectionName: sectionData?.name,
    });
  }

  async generateStudentId(
    input: GenerateStudentIdDto,
    branchId: string,
  ): Promise<{ studentId: string }> {
    const supabase = this.supabaseConfig.getClient();

    // Get active academic year if not provided
    let academicYearId = input.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.academicYearsService.getActive();
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      academicYearId = activeYear.id;
    }

    // Get academic year name (e.g., "2024-2025" -> "2024")
    const { data: year } = await supabase
      .from('academic_years')
      .select('name')
      .eq('id', academicYearId)
      .single();

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    const yearPrefix = year.name.split('-')[0] || year.name.substring(0, 4);

    // Get class and section codes
    let classCode = '';
    let sectionCode = '';

    if (input.classId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('name')
        .eq('id', input.classId)
        .single();

      if (classData) {
        classCode = classData.name;
      }
    }

    if (input.sectionId) {
      const { data: sectionData } = await supabase
        .from('sections')
        .select('name')
        .eq('id', input.sectionId)
        .single();

      if (sectionData) {
        sectionCode = sectionData.name;
      }
    }

    // Find the highest sequence number for this pattern
    const pattern = `${yearPrefix}-${classCode}-${sectionCode}-%`;
    const { data: existing } = await supabase
      .from('students')
      .select('student_id')
      .eq('branch_id', branchId)
      .ilike('student_id', pattern)
      .order('student_id', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (existing && existing.length > 0) {
      const lastId = existing[0].student_id;
      const parts = lastId.split('-');
      const lastSeq = parseInt(parts[parts.length - 1] || '0', 10);
      sequence = lastSeq + 1;
    }

    const studentId = `${yearPrefix}-${classCode}-${sectionCode}-${sequence.toString().padStart(3, '0')}`;

    return { studentId };
  }

  async createStudent(input: CreateStudentDto, branchId: string): Promise<StudentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Check if student_id already exists in this branch
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', input.studentId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Student ID ${input.studentId} already exists in this branch`);
    }

    // Get active academic year if not provided
    let academicYearId = input.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.academicYearsService.getActive();
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      academicYearId = activeYear.id;
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

    try {
      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: input.fullName,
        avatar_url: input.avatarUrl ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        date_of_birth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        is_active: input.isActive ?? true,
      });

      throwIfDbError(profileError);

      // Assign to branch
      const { error: branchError } = await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branchId,
        is_primary: false,
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
        });
      }

      // Create student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: user.id,
          branch_id: branchId,
          student_id: input.studentId,
          class_id: input.classId ?? null,
          section_id: input.sectionId ?? null,
          blood_group: input.bloodGroup ?? null,
          medical_notes: input.medicalNotes ?? null,
          admission_date: input.admissionDate ?? null,
          academic_year_id: academicYearId,
          is_active: input.isActive ?? true,
        })
        .select()
        .single();

      throwIfDbError(studentError);
      if (!student) {
        throw new BadRequestException('Failed to create student record');
      }

      return this.getStudentById((student as StudentRow).id, branchId);
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
  ): Promise<StudentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify student exists in branch
    await this.getStudentById(id, branchId);

    // Update profile if fullName provided
    if (input.fullName || input.phone || input.address || input.dateOfBirth || input.gender) {
      const { data: student } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', id)
        .single();

      if (student) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: input.fullName,
            phone: input.phone,
            address: input.address,
            date_of_birth: input.dateOfBirth,
            gender: input.gender,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (student as { user_id: string }).user_id);

        throwIfDbError(profileError);
      }
    }

    // Update student record
    const { error } = await supabase
      .from('students')
      .update({
        class_id: input.classId ?? undefined,
        section_id: input.sectionId ?? undefined,
        blood_group: input.bloodGroup,
        medical_notes: input.medicalNotes,
        admission_date: input.admissionDate,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    throwIfDbError(error);

    return this.getStudentById(id, branchId);
  }

  async bulkImport(
    students: CreateStudentDto[],
    branchId: string,
  ): Promise<{ success: number; errors: Array<{ row: number; error: string }> }> {
    const results = { success: 0, errors: [] as Array<{ row: number; error: string }> };

    for (let i = 0; i < students.length; i++) {
      try {
        await this.createStudent(students[i], branchId);
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

