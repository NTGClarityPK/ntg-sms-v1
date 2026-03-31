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
import { CreateStudentWithInvitationDto } from './dto/create-student-with-invitation.dto';
import { ReinviteStudentDto } from './dto/reinvite-student.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';
import { InvitationsService } from '../invitations/invitations.service';
import { ParentsService } from '../parents/parents.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import crypto from 'crypto';

type StudentRow = {
  id: string;
  user_id: string | null;
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
  account_status?: string | null;
};

function accountStatusFromRow(v: unknown): 'active' | 'pending_verification' | 'link_expired' {
  if (v === 'pending_verification' || v === 'link_expired' || v === 'active') return v;
  return 'active';
}

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class StudentsService {
  // Simple in-memory caches (Nest provider is a singleton).
  private readonly tenantDomainByBranchId = new Map<string, string>();
  private readonly roleIdByName = new Map<string, string>();

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly invitationsService: InvitationsService,
    private readonly parentsService: ParentsService,
  ) {}

  private randomTempPassword(): string {
    // >= 24 chars, includes letters+numbers to satisfy common policies.
    return crypto.randomBytes(24).toString('base64url');
  }

  /**
   * Normalise login emails so duplicates can't slip in due to casing or whitespace.
   * Supabase Auth stores emails as provided, so we always canonicalise to lowercase.
   */
  private normalizeLoginEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private async getTenantDomainForBranch(branchId: string): Promise<string> {
    const cached = this.tenantDomainByBranchId.get(branchId);
    if (cached) return cached;
    const supabase = this.supabaseConfig.getClient();
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(branchError);

    const tenantId = (branch as { tenant_id: string | null } | null)?.tenant_id ?? null;
    if (!tenantId) {
      throw new BadRequestException('Tenant not resolved for this branch');
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('domain')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(tenantError);
    const domain = (tenant as { domain: string } | null)?.domain?.trim().toLowerCase();
    if (!domain) {
      throw new BadRequestException('Tenant domain is not configured');
    }
    this.tenantDomainByBranchId.set(branchId, domain);
    return domain;
  }

  private async getRoleIdByName(roleName: string): Promise<string | null> {
    const key = roleName.trim().toLowerCase();
    const cached = this.roleIdByName.get(key);
    if (cached) return cached;
    const supabase = this.supabaseConfig.getClient();
    const { data } = await supabase
      .from('roles')
      .select('id')
      .eq('name', key)
      .maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    if (id) this.roleIdByName.set(key, id);
    return id;
  }

  private buildLoginEmail(username: string, domain: string): string {
    return `${this.normalizeUsername(username)}@${domain.trim().toLowerCase()}`;
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0] || email;
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    return cleaned ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : email;
  }

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

    // Search:
    // - We can filter by first_name/last_name/student_id at DB level.
    // - Email is not stored in the students table (resolved via Supabase auth admin), so email search
    //   must be done client-side after we resolve emails. When the search looks like an email, we avoid
    //   DB-level name filters to prevent excluding the correct rows.
    const searchTerms = (query.search ?? '')
      .trim()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const hasSearch = searchTerms.length > 0;
    const isEmailLikeSearch =
      hasSearch && searchTerms.some((t) => t.includes('@'));
    const isSingleToken = searchTerms.length === 1;
    const singleToken = isSingleToken ? searchTerms[0] : '';
    const isUsernameLikeToken =
      isSingleToken && /^[a-z0-9]+$/i.test(singleToken) && singleToken.length >= 3;
    if (hasSearch) {
      if (!isEmailLikeSearch) {
        // When searching by a single username-like token (e.g. "john221"), users typically
        // expect it to match the email local-part too. Email isn't in the students table,
        // so do NOT apply DB-level name filters here (which would exclude the right row).
        // We'll fetch a larger candidate set and filter client-side (including email).
        if (!isUsernameLikeToken) {
          // Include student_id so searching by ID works without relying on client-side filtering.
          const orFilter = searchTerms
            .map((t) => `first_name.ilike.%${t}%,last_name.ilike.%${t}%,student_id.ilike.%${t}%`)
            .join(',');
          dbQuery = dbQuery.or(orFilter);
        }
      } else {
        // Email search: use profiles.email (fast) to resolve matching auth IDs,
        // then filter students by user_id.
        // NOTE: profiles.email must be populated (we now set it when creating students).
        const emailTerm = searchTerms.join(' ').toLowerCase();
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', `%${emailTerm}%`)
          .limit(200);
        throwIfDbError(profilesError);
        const matchedUserIds = (profiles || []).map((p: { id: string }) => p.id);
        if (matchedUserIds.length === 0) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 0 },
          };
        }
        dbQuery = dbQuery.in('user_id', matchedUserIds);
      }
    }

    // When searching (especially by email), we need a larger candidate set for client-side filtering.
    const fetchLimit = hasSearch ? 1000 : limit;
    const fetchTo = hasSearch ? from + fetchLimit - 1 : to;
    let dbQueryWithLimit = dbQuery.range(from, fetchTo);

    const { data, error, count } = await dbQueryWithLimit;

    throwIfDbError(error);

    const userIds = (data as unknown as Array<{ user_id: string | null }>)
      .map((s) => s.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

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
      user_id: string | null;
      branch_id: string;
      student_id: string;
      class_id: string | null;
      section_id: string | null;
      blood_group: string | null;
      medical_notes: string | null;
      admission_date: string | null;
      academic_year_id: string | null;
      is_active: boolean;
      account_status?: string | null;
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
        userId: row.user_id ?? undefined,
        branchId: row.branch_id,
        studentId: row.student_id,
        classId: row.class_id ?? undefined,
        sectionId: row.section_id ?? undefined,
        bloodGroup: row.blood_group ?? undefined,
        medicalNotes: row.medical_notes ?? undefined,
        admissionDate: row.admission_date ?? undefined,
        academicYearId: row.academic_year_id ?? undefined,
        isActive: row.is_active,
        accountStatus: accountStatusFromRow(row.account_status),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        email: row.user_id ? emailMap.get(row.user_id) : undefined,
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
      user_id: string | null;
      branch_id: string;
      student_id: string;
      class_id: string | null;
      section_id: string | null;
      blood_group: string | null;
      medical_notes: string | null;
      admission_date: string | null;
      academic_year_id: string | null;
      is_active: boolean;
      account_status?: string | null;
      created_at: string;
      updated_at: string;
      first_name: string | null;
      last_name: string | null;
      classes: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    };

    const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;

    const { data: authUser } = row.user_id
      ? await supabase.auth.admin.getUserById(row.user_id)
      : { data: { user: null } };

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
      userId: row.user_id ?? undefined,
      branchId: row.branch_id,
      studentId: row.student_id,
      classId: row.class_id ?? undefined,
      sectionId: row.section_id ?? undefined,
      bloodGroup: row.blood_group ?? undefined,
      medicalNotes: row.medical_notes ?? undefined,
      admissionDate: row.admission_date ?? undefined,
      academicYearId: row.academic_year_id ?? undefined,
      isActive: row.is_active,
      accountStatus: accountStatusFromRow(row.account_status),
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

    const tenantDomain = await this.getTenantDomainForBranch(branchId);
    const normalizedLoginEmail = this.normalizeLoginEmail(
      this.buildLoginEmail(input.username, tenantDomain),
    );

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
      email: normalizedLoginEmail,
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
        email: normalizedLoginEmail,
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
      const studentRoleId = await this.getRoleIdByName('student');
      if (studentRoleId) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: studentRoleId,
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
          account_status: 'active',
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

  async createStudentWithInvitation(
    input: CreateStudentWithInvitationDto,
    branchId: string,
    adminUser: CurrentUserPayload,
  ): Promise<{
    student: StudentDto;
    studentInvitation: { token: string; recipientEmail: string; invitationType: 'parent' | 'student'; expiresAt: string };
    parentInvitation?: { token: string; recipientEmail: string; expiresAt: string; parentUserId: string };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(adminUser.email);

    const tenantDomain = await this.getTenantDomainForBranch(branchId);
    const normalizedLoginEmail = this.normalizeLoginEmail(
      this.buildLoginEmail(input.username, tenantDomain),
    );

    // Active academic year fallback (same logic as createStudent)
    let academicYearId: string | null = input.academicYearId ?? null;
    if (!academicYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      academicYearId = activeYear?.id ?? null;
    }

    const studentTempPassword = this.randomTempPassword();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.admin.createUser({
      email: normalizedLoginEmail,
      password: studentTempPassword,
      email_confirm: true,
    });
    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictException('User with this email already exists');
      }
      throw new BadRequestException(authError.message);
    }
    if (!user) throw new BadRequestException('Failed to create user');

    const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

    try {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: displayName,
        email: normalizedLoginEmail,
        avatar_url: null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        date_of_birth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        is_active: input.isActive ?? true,
        created_by: username,
        updated_by: username,
      });
      throwIfDbError(profileError);

      const { error: branchError } = await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branchId,
        is_primary: false,
        created_by: username,
      });
      if (branchError) throw new BadRequestException(branchError.message);

      const studentRoleId = await this.getRoleIdByName('student');
      if (studentRoleId) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: studentRoleId,
          branch_id: branchId,
          created_by: username,
        });
      }

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
          is_active: false,
          account_status: 'pending_verification',
          created_by: username,
          updated_by: username,
        })
        .select()
        .single();

      if (studentError) {
        if (studentError.code === '23505' && studentError.message.includes('students_student_id_key')) {
          throw new ConflictException('Student ID already exists. Please try again.');
        }
        throwIfDbError(studentError);
      }
      if (!student) throw new BadRequestException('Failed to create student record');

      const studentRow = student as StudentRow;

      // Optional: template assignment
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
            { onConflict: 'student_id,academic_year_id' },
          );
        throwIfDbError(assignmentError);
      }

      // Scenario 3: create parent account if requested (and email provided)
      let parentInvitation:
        | { token: string; recipientEmail: string; expiresAt: string; parentUserId: string }
        | undefined;

      if (input.createParentAccount) {
        const parentEmail = this.normalizeLoginEmail(input.parentEmail ?? '');
        if (!parentEmail) {
          throw new BadRequestException('Parent email is required to create a parent account');
        }
        const parentName = (input.parentName ?? '').trim() || this.nameFromEmail(parentEmail);

        // If the parent already exists (same email), reuse and just link.
        const { data: existingParentUserId } = await supabase.rpc('auth_user_id_by_email', {
          p_email: parentEmail,
        });

        const parentUserId: string = (() => {
          if (typeof existingParentUserId === 'string' && existingParentUserId.trim() !== '') {
            return existingParentUserId.trim();
          }
          return '';
        })();

        let createdNewParent = false;
        let parentUserIdToUse = parentUserId;

        if (!parentUserIdToUse) {
          const parentTempPassword = this.randomTempPassword();
          const {
            data: { user: parentUser },
            error: parentAuthError,
          } = await supabase.auth.admin.createUser({
            email: parentEmail,
            password: parentTempPassword,
            email_confirm: true,
          });
          if (parentAuthError) throw new BadRequestException(parentAuthError.message);
          if (!parentUser) throw new BadRequestException('Failed to create parent user');
          parentUserIdToUse = parentUser.id;
          createdNewParent = true;
        }

        // Ensure parent has profile, branch, role (idempotent)
        const { error: parentProfileError } = await supabase.from('profiles').upsert(
          {
            id: parentUserIdToUse,
            full_name: parentName,
            avatar_url: null,
            phone: input.parentPhone ?? null,
            address: null,
            date_of_birth: null,
            gender: null,
            is_active: true,
            created_by: username,
            updated_by: username,
          },
          { onConflict: 'id' },
        );
        throwIfDbError(parentProfileError);

        const { error: parentBranchError } = await supabase.from('user_branches').upsert(
          {
            user_id: parentUserIdToUse,
            branch_id: branchId,
            is_primary: false,
            created_by: username,
          },
          { onConflict: 'user_id,branch_id' },
        );
        if (parentBranchError) throw new BadRequestException(parentBranchError.message);

        const parentRoleId = await this.getRoleIdByName('parent');
        if (parentRoleId) {
          await supabase.from('user_roles').upsert(
            {
              user_id: parentUserIdToUse,
              role_id: parentRoleId,
              branch_id: branchId,
              created_by: username,
            },
            { onConflict: 'user_id,role_id,branch_id' },
          );
        }

        // Link parent to student
        await this.parentsService.linkChild(
          parentUserIdToUse,
          {
            studentId: studentRow.id,
            relationship: input.parentRelationship ?? 'guardian',
            isPrimary: true,
            canApprove: true,
          },
          adminUser.email,
          branchId,
          null,
        );

        // Parent invitation (self setup) -> only send if:
        // - we just created the parent, OR
        // - the latest unused invitation is expired (resend policy)
        const nowIso = new Date().toISOString();
        const { data: latestParentInv } = await supabase
          .from('invitations')
          .select('id, token, user_id, recipient_email, invitation_type, created_by, created_at, expires_at, used_at')
          .eq('user_id', parentUserIdToUse)
          .eq('invitation_type', 'parent_account')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const latest = latestParentInv as
          | { expires_at: string; used_at: string | null }
          | null;
        const latestIsExpired =
          !!latest?.expires_at && latest.expires_at < nowIso && latest.used_at == null;

        if (createdNewParent || latestIsExpired) {
          const parentInv = await this.invitationsService.createInvitation({
            userId: parentUserIdToUse,
            recipientEmail: parentEmail,
            invitationType: 'parent_account',
            createdByUserId: adminUser.id,
          });
          await this.invitationsService.sendInvitationEmail({
            invitation: parentInv,
            recipientName: parentName,
            loginEmail: parentEmail,
            userEmailForAudit: adminUser.email,
            branchId,
          });
          parentInvitation = {
            token: parentInv.token,
            recipientEmail: parentInv.recipient_email,
            expiresAt: parentInv.expires_at,
            parentUserId: parentUserIdToUse,
          };
        }
      }

      // Student invitation (scenario 1 or 2)
      const recipientEmail = (() => {
        const raw = (input.invitationRecipientEmail ?? '').trim();
        // Parent invitations must always be a real email address (validated in DTO).
        if (input.invitationType === 'parent') return this.normalizeLoginEmail(raw);

        // Student invitations: allow empty/username; build a valid email using tenant domain.
        // If raw already looks like an email, normalise it and use as-is.
        if (raw.includes('@')) return this.normalizeLoginEmail(raw);
        const fallbackUsername = raw || input.username;
        return this.normalizeLoginEmail(this.buildLoginEmail(fallbackUsername, tenantDomain));
      })();
      const invitationType = input.invitationType;
      const recipientName =
        invitationType === 'parent'
          ? this.nameFromEmail(recipientEmail)
          : displayName;

      const inv = await this.invitationsService.createInvitation({
        userId: user.id,
        recipientEmail,
        invitationType: invitationType === 'parent' ? 'parent' : 'student',
        createdByUserId: adminUser.id,
      });

      await this.invitationsService.sendInvitationEmail({
        invitation: inv,
        recipientName,
        loginEmail: normalizedLoginEmail,
        studentName: displayName,
        userEmailForAudit: adminUser.email,
        branchId,
      });

      const studentDto = await this.getStudentById(studentRow.id, branchId);

      return {
        student: studentDto,
        studentInvitation: {
          token: inv.token,
          recipientEmail: inv.recipient_email,
          invitationType,
          expiresAt: inv.expires_at,
        },
        parentInvitation,
      };
    } catch (error) {
      await supabase.auth.admin.deleteUser(user.id);
      throw error;
    }
  }

  /**
   * After an unused invitation expired and auth was purged, create a new auth user and invitation.
   * Requires the admin to supply the student login email again (it is not stored on the student row).
   */
  async reinviteStudentAfterLinkExpired(
    studentId: string,
    branchId: string,
    input: ReinviteStudentDto,
    adminUser: CurrentUserPayload,
  ): Promise<{
    student: StudentDto;
    studentInvitation: {
      token: string;
      recipientEmail: string;
      invitationType: 'parent' | 'student';
      expiresAt: string;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(adminUser.email);
    const tenantDomain = await this.getTenantDomainForBranch(branchId);
    const normalizedLoginEmail = this.normalizeLoginEmail(
      this.buildLoginEmail(input.username, tenantDomain),
    );

    const { data: existing, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(fetchErr);
    if (!existing) {
      throw new NotFoundException('Student not found');
    }

    const row = existing as StudentRow;
    if (row.account_status !== 'link_expired' || row.user_id != null) {
      throw new BadRequestException(
        'Re-invite is only available for students whose setup link expired and whose login account was removed',
      );
    }

    const displayName = `${(row.first_name ?? '').trim()} ${(row.last_name ?? '').trim()}`.trim();
    if (!displayName) {
      throw new BadRequestException('Student record is missing a name');
    }

    const studentTempPassword = this.randomTempPassword();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.admin.createUser({
      email: normalizedLoginEmail,
      password: studentTempPassword,
      email_confirm: true,
    });
    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictException('User with this email already exists');
      }
      throw new BadRequestException(authError.message);
    }
    if (!user) throw new BadRequestException('Failed to create user');

    try {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: displayName,
        email: normalizedLoginEmail,
        avatar_url: null,
        phone: null,
        address: null,
        date_of_birth: null,
        gender: null,
        is_active: false,
        created_by: username,
        updated_by: username,
      });
      throwIfDbError(profileError);

      const { error: branchError } = await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branchId,
        is_primary: false,
        created_by: username,
      });
      if (branchError) throw new BadRequestException(branchError.message);

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

      const { error: updErr } = await supabase
        .from('students')
        .update({
          user_id: user.id,
          account_status: 'pending_verification',
          is_active: false,
          updated_at: new Date().toISOString(),
          updated_by: username,
        })
        .eq('id', studentId)
        .eq('branch_id', branchId);
      throwIfDbError(updErr);

      const recipientEmail = (() => {
        const raw = (input.invitationRecipientEmail ?? '').trim();
        if (input.invitationType === 'parent') return this.normalizeLoginEmail(raw);
        if (raw.includes('@')) return this.normalizeLoginEmail(raw);
        const fallbackUsername = raw || input.username;
        return this.normalizeLoginEmail(this.buildLoginEmail(fallbackUsername, tenantDomain));
      })();
      const invitationType = input.invitationType;
      const recipientName =
        invitationType === 'parent'
          ? this.nameFromEmail(recipientEmail)
          : displayName;

      const inv = await this.invitationsService.createInvitation({
        userId: user.id,
        recipientEmail,
        invitationType: invitationType === 'parent' ? 'parent' : 'student',
        createdByUserId: adminUser.id,
      });

      await this.invitationsService.sendInvitationEmail({
        invitation: inv,
        recipientName,
        loginEmail: normalizedLoginEmail,
        studentName: displayName,
        userEmailForAudit: adminUser.email,
        branchId,
      });

      const studentDto = await this.getStudentById(studentId, branchId);

      return {
        student: studentDto,
        studentInvitation: {
          token: inv.token,
          recipientEmail: inv.recipient_email,
          invitationType,
          expiresAt: inv.expires_at,
        },
      };
    } catch (error) {
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

    const oldRowWithName = oldRow as {
      first_name?: string | null;
      last_name?: string | null;
      user_id: string | null;
    };
    const newFirst = input.firstName !== undefined ? input.firstName.trim() : (oldRowWithName.first_name ?? '');
    const newLast = input.lastName !== undefined ? input.lastName.trim() : (oldRowWithName.last_name ?? '');
    const displayName = `${newFirst} ${newLast}`.trim();

    if (displayName || input.phone !== undefined || input.address !== undefined || input.dateOfBirth !== undefined || input.gender !== undefined) {
      const { data: student } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', id)
        .single();

      const stuUserId = (student as { user_id: string | null }).user_id;
      if (stuUserId) {
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
          .eq('id', stuUserId);

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

