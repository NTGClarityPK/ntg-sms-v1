import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { ParentStudentDto } from './dto/parent-student.dto';
import { LinkChildDto } from './dto/link-child.dto';
import { SelectChildDto } from './dto/select-child.dto';
import { UpdateParentAssociationDto } from './dto/update-parent-association.dto';

type ParentStudentRow = {
  id: string;
  parent_user_id: string;
  student_id: string;
  relationship: 'father' | 'mother' | 'guardian';
  is_primary: boolean;
  can_approve: boolean;
  priority: number | null;
  created_at: string;
};

type StudentRowLite = {
  id: string;
  student_id: string;
  user_id: string | null;
  branch_id?: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class ParentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async hydrateAssociations(
    rows: ParentStudentRow[],
  ): Promise<ParentStudentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    if (rows.length === 0) return [];

    const parentUserIds = [...new Set(rows.map((r) => r.parent_user_id))];
    const studentIds = [...new Set(rows.map((r) => r.student_id))];

    // Names, phones, emails from profiles — avoid Auth Admin getUserById storms on Nano.
    const { data: parentProfiles, error: parentProfilesError } =
      parentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, phone, email')
            .in('id', parentUserIds)
        : { data: [], error: null };
    throwIfDbError(parentProfilesError);

    const parentNameById = new Map(
      (parentProfiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string }).full_name,
      ]),
    );

    const parentPhoneById = new Map(
      (parentProfiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { phone: string | null })?.phone ?? undefined,
      ]),
    );

    const emailMap = new Map<string, string>();
    (parentProfiles || []).forEach((p) => {
      const email = (p as { email?: string | null }).email;
      if (email) emailMap.set((p as { id: string }).id, email);
    });

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, student_id, user_id, first_name, last_name')
      .in('id', studentIds);
    throwIfDbError(studentsError);

    const studentRows = (students || []) as unknown as Array<StudentRowLite & { first_name?: string | null; last_name?: string | null }>;
    const studentById = new Map(studentRows.map((s) => [s.id, s]));

    return rows.map((row) => {
      const student = studentById.get(row.student_id);
      const firstName = student?.first_name ?? undefined;
      const lastName = student?.last_name ?? undefined;
      const studentName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

      return new ParentStudentDto({
        id: row.id,
        parentUserId: row.parent_user_id,
        studentId: row.student_id,
        relationship: row.relationship,
        isPrimary: row.is_primary,
        canApprove: row.can_approve,
        priority: row.priority ?? undefined,
        createdAt: row.created_at,
        parentName: parentNameById.get(row.parent_user_id),
        studentName,
        firstName,
        lastName,
        studentStudentId: student?.student_id,
        parentPhone: parentPhoneById.get(row.parent_user_id),
        parentEmail: emailMap.get(row.parent_user_id),
      });
    });
  }

  async getChildren(parentUserId: string, branchId?: string): Promise<ParentStudentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    let dbQuery = supabase
      .from('parent_students')
      .select('*')
      .eq('parent_user_id', parentUserId);

    // Filter by branch if provided
    if (branchId) {
      // First get all students in this branch
      const { data: branchStudents } = await supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId);

      const studentIds = branchStudents?.map((s) => s.id) || [];
      if (studentIds.length === 0) {
        return [];
      }
      dbQuery = dbQuery.in('student_id', studentIds);
    }

    const { data, error } = await dbQuery.order('priority', { ascending: true, nullsFirst: false });

    throwIfDbError(error);

    return this.hydrateAssociations((data || []) as unknown as ParentStudentRow[]);
  }

  async linkChild(
    parentUserId: string,
    input: LinkChildDto,
    userEmail: string,
    branchId?: string,
    tenantId?: string | null,
  ): Promise<ParentStudentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify student exists
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', input.studentId)
      .single();

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Check if link already exists
    const { data: existing } = await supabase
      .from('parent_students')
      .select('id')
      .eq('parent_user_id', parentUserId)
      .eq('student_id', input.studentId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Child is already linked to this parent');
    }

    // Check current guardian count for this student
    const { data: existingGuardians, error: countError } = await supabase
      .from('parent_students')
      .select('id, priority')
      .eq('student_id', input.studentId);

    throwIfDbError(countError);

    const guardianCount = (existingGuardians || []).length;
    
    // Enforce max 2 guardians per student
    if (guardianCount >= 2) {
      throw new BadRequestException('Maximum 2 guardians allowed per student');
    }

    // Determine priority: auto-assign if not provided
    let priority: number;
    if (input.priority !== undefined) {
      // Validate provided priority
      if (input.priority < 1 || input.priority > 2) {
        throw new BadRequestException('Priority must be 1 or 2');
      }
      // Check if priority already exists
      const priorityExists = (existingGuardians || []).some(
        (g) => g.priority === input.priority,
      );
      if (priorityExists) {
        throw new BadRequestException(`Priority ${input.priority} already assigned to another guardian`);
      }
      priority = input.priority;
    } else {
      // Auto-assign priority: 1 if no guardians, 2 if one guardian exists
      priority = guardianCount === 0 ? 1 : 2;
    }

    // If this is marked as primary, unset other primary links (backward compatibility)
    if (input.isPrimary) {
      await supabase
        .from('parent_students')
        .update({ is_primary: false })
        .eq('parent_user_id', parentUserId);
    }

    const { data, error } = await supabase
      .from('parent_students')
      .insert({
        parent_user_id: parentUserId,
        student_id: input.studentId,
        relationship: input.relationship,
        is_primary: input.isPrimary ?? false,
        can_approve: input.canApprove ?? true,
        priority,
      })
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to link child');
    }

    const row = data as ParentStudentRow;
    this.auditLogService
      .logCreate('parent_students', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId: branchId ?? null,
        tenantId: tenantId ?? null,
      })
      .catch(() => {});
    const children = await this.getChildren(parentUserId);
    return children.find((c) => c.id === row.id)!;
  }

  async updateParentAssociation(
    parentUserId: string,
    studentId: string,
    input: UpdateParentAssociationDto,
    userEmail: string,
    branchId?: string,
    tenantId?: string | null,
  ): Promise<ParentStudentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify association exists
    const { data: existing, error: checkError } = await supabase
      .from('parent_students')
      .select('*')
      .eq('parent_user_id', parentUserId)
      .eq('student_id', studentId)
      .maybeSingle();

    throwIfDbError(checkError);
    if (!existing) {
      throw new NotFoundException('Parent-student association not found');
    }

    // Build update object
    const updateData: Partial<ParentStudentRow> = {};
    if (input.canApprove !== undefined) {
      updateData.can_approve = input.canApprove;
    }

    // Update if there are changes
    if (Object.keys(updateData).length > 0) {
      const oldRow = existing as Record<string, unknown>;
      const { data, error } = await supabase
        .from('parent_students')
        .update(updateData)
        .eq('parent_user_id', parentUserId)
        .eq('student_id', studentId)
        .select()
        .single();

      throwIfDbError(error);
      if (!data) {
        throw new BadRequestException('Failed to update association');
      }

      const newRow = data as Record<string, unknown>;
      const changedFields = Object.keys(updateData) as string[];
      this.auditLogService
        .logUpdate(
          'parent_students',
          (existing as { id: string }).id,
          userEmail,
          oldRow,
          newRow,
          changedFields,
          { branchId: branchId ?? null, tenantId: tenantId ?? null },
        )
        .catch(() => {});
      const hydrated = await this.hydrateAssociations([data as unknown as ParentStudentRow]);
      return hydrated[0]!;
    }

    // No changes, return existing
    const hydrated = await this.hydrateAssociations([existing as unknown as ParentStudentRow]);
    return hydrated[0]!;
  }

  async unlinkChild(
    parentUserId: string,
    studentId: string,
    userEmail: string,
    branchId?: string,
    tenantId?: string | null,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Get full row for audit and priority check
    const { data: oldRow, error: fetchError } = await supabase
      .from('parent_students')
      .select('*')
      .eq('parent_user_id', parentUserId)
      .eq('student_id', studentId)
      .maybeSingle();
    throwIfDbError(fetchError);

    const { error } = await supabase
      .from('parent_students')
      .delete()
      .eq('parent_user_id', parentUserId)
      .eq('student_id', studentId);

    throwIfDbError(error);

    if (oldRow) {
      this.auditLogService
        .logDelete(
          'parent_students',
          (oldRow as { id: string }).id,
          userEmail,
          oldRow as Record<string, unknown>,
          { branchId: branchId ?? null, tenantId: tenantId ?? null },
        )
        .catch(() => {});
    }

    if (oldRow && (oldRow as { priority: number }).priority === 1) {
      await supabase
        .from('parent_students')
        .update({ priority: 1 })
        .eq('student_id', studentId)
        .eq('priority', 2);
    }
  }

  /**
   * Get all guardians for a student, ordered by priority (1 = Primary, 2 = Secondary)
   */
  async getGuardiansForStudent(studentId: string): Promise<ParentStudentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('parent_students')
      .select('*')
      .eq('student_id', studentId)
      .order('priority', { ascending: true, nullsFirst: false });

    throwIfDbError(error);

    return this.hydrateAssociations((data || []) as unknown as ParentStudentRow[]);
  }

  /**
   * Get primary guardian (priority 1) for a student
   */
  async getPrimaryGuardian(studentId: string): Promise<ParentStudentDto | null> {
    const guardians = await this.getGuardiansForStudent(studentId);
    return guardians.find((g) => g.priority === 1) || null;
  }

  /**
   * Get secondary guardian (priority 2) for a student
   */
  async getSecondaryGuardian(studentId: string): Promise<ParentStudentDto | null> {
    const guardians = await this.getGuardiansForStudent(studentId);
    return guardians.find((g) => g.priority === 2) || null;
  }

  async selectChild(userId: string, input: SelectChildDto): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Verify user has access to this student (via parent_students)
    const { data: link } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_user_id', userId)
      .eq('student_id', input.studentId)
      .maybeSingle();

    if (!link) {
      throw new BadRequestException('You do not have access to this student');
    }

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ current_student_id: input.studentId })
      .eq('id', userId);

    throwIfDbError(error);
  }

  async getCurrentChild(userId: string): Promise<ParentStudentDto | null> {
    const supabase = this.supabaseConfig.getClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_student_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile || !(profile as { current_student_id: string | null }).current_student_id) {
      return null;
    }

    const currentStudentId = (profile as { current_student_id: string }).current_student_id;

    const { data, error } = await supabase
      .from('parent_students')
      .select('*')
      .eq('parent_user_id', userId)
      .eq('student_id', currentStudentId)
      .maybeSingle();

    throwIfDbError(error);

    if (!data) return null;

    const hydrated = await this.hydrateAssociations([data as unknown as ParentStudentRow]);
    return hydrated[0] ?? null;
  }

  async listAssociations(
    query: {
      page: number;
      limit: number;
      parentId?: string;
      studentId?: string;
      /** Free-text: matches student first/last name or student_id, or parent profile full_name / email */
      search?: string;
    },
    branchId: string,
  ): Promise<{
    data: ParentStudentDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build query - avoid relationship syntax; schema cache might not have FKs for parent_students
    let dbQuery = supabase.from('parent_students').select('*', { count: 'exact' });

    // Filter by branch via students
    if (branchId) {
      // First get all students in this branch
      const { data: branchStudents } = await supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId);

      const studentIds = branchStudents?.map((s) => s.id) || [];
      if (studentIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      dbQuery = dbQuery.in('student_id', studentIds);
    }

    // Filter by parent if provided
    if (query.parentId) {
      dbQuery = dbQuery.eq('parent_user_id', query.parentId);
    }

    // Filter by student if provided
    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }

    const searchRaw = (query.search ?? '').trim();
    const searchTerms = searchRaw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (searchTerms.length > 0 && branchId) {
      const isEmailLikeSearch = searchTerms.some((t) => t.includes('@'));
      let matchingStudentIds: string[] = [];
      let matchingParentProfileIds: string[] = [];

      if (isEmailLikeSearch) {
        const emailTerm = searchTerms.join(' ').toLowerCase();
        const { data: emailProfiles, error: emailProfilesError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', `%${emailTerm}%`)
          .limit(200);
        throwIfDbError(emailProfilesError);
        matchingParentProfileIds = (emailProfiles || []).map((p: { id: string }) => p.id);
      } else {
        const orFilter = searchTerms
          .map(
            (t) =>
              `first_name.ilike.%${t}%,last_name.ilike.%${t}%,student_id.ilike.%${t}%`,
          )
          .join(',');
        const { data: nameStudents, error: nameStudentsError } = await supabase
          .from('students')
          .select('id')
          .eq('branch_id', branchId)
          .or(orFilter);
        throwIfDbError(nameStudentsError);
        matchingStudentIds = (nameStudents || []).map((s: { id: string }) => s.id);

        const { data: nameProfiles, error: nameProfilesError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', `%${searchRaw}%`)
          .limit(200);
        throwIfDbError(nameProfilesError);
        matchingParentProfileIds = (nameProfiles || []).map((p: { id: string }) => p.id);
      }

      if (matchingStudentIds.length === 0 && matchingParentProfileIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      if (matchingStudentIds.length > 0 && matchingParentProfileIds.length > 0) {
        dbQuery = dbQuery.or(
          `student_id.in.(${matchingStudentIds.join(',')}),parent_user_id.in.(${matchingParentProfileIds.join(',')})`,
        );
      } else if (matchingStudentIds.length > 0) {
        dbQuery = dbQuery.in('student_id', matchingStudentIds);
      } else {
        dbQuery = dbQuery.in('parent_user_id', matchingParentProfileIds);
      }
    }

    // Apply pagination
    // Order by priority first (1 = Primary, 2 = Secondary), then by created_at descending
    // This ensures guardians are sorted correctly when filtering by student
    const { data, error, count } = await dbQuery
      .range(from, to)
      .order('priority', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (!data || data.length === 0) {
      return {
        data: [],
        meta: { total, page, limit, totalPages },
      };
    }

    const associations = await this.hydrateAssociations(
      (data || []) as unknown as ParentStudentRow[],
    );

    return {
      data: associations,
      meta: { total, page, limit, totalPages },
    };
  }
}

