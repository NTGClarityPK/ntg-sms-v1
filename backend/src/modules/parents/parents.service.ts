import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { ParentStudentDto } from './dto/parent-student.dto';
import { LinkChildDto } from './dto/link-child.dto';
import { SelectChildDto } from './dto/select-child.dto';

type ParentStudentRow = {
  id: string;
  parent_user_id: string;
  student_id: string;
  relationship: 'father' | 'mother' | 'guardian';
  is_primary: boolean;
  can_approve: boolean;
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
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  private async hydrateAssociations(
    rows: ParentStudentRow[],
  ): Promise<ParentStudentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    if (rows.length === 0) return [];

    const parentUserIds = [...new Set(rows.map((r) => r.parent_user_id))];
    const studentIds = [...new Set(rows.map((r) => r.student_id))];

    const { data: parentProfiles, error: parentProfilesError } =
      parentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', parentUserIds)
        : { data: [], error: null };
    throwIfDbError(parentProfilesError);

    const parentNameById = new Map(
      (parentProfiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string }).full_name,
      ]),
    );

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, student_id, user_id')
      .in('id', studentIds);
    throwIfDbError(studentsError);

    const studentRows = (students || []) as unknown as StudentRowLite[];
    const studentUserIds = [
      ...new Set(
        studentRows
          .map((s) => s.user_id)
          .filter((id): id is string => !!id),
      ),
    ];

    const { data: studentProfiles, error: studentProfilesError } =
      studentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentUserIds)
        : { data: [], error: null };
    throwIfDbError(studentProfilesError);

    const studentNameByUserId = new Map(
      (studentProfiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string }).full_name,
      ]),
    );

    const studentById = new Map(studentRows.map((s) => [s.id, s]));

    return rows.map((row) => {
      const student = studentById.get(row.student_id);
      const studentName = student?.user_id
        ? studentNameByUserId.get(student.user_id)
        : undefined;

      return new ParentStudentDto({
        id: row.id,
        parentUserId: row.parent_user_id,
        studentId: row.student_id,
        relationship: row.relationship,
        isPrimary: row.is_primary,
        canApprove: row.can_approve,
        createdAt: row.created_at,
        parentName: parentNameById.get(row.parent_user_id),
        studentName,
        studentStudentId: student?.student_id,
      });
    });
  }

  async getChildren(parentUserId: string): Promise<ParentStudentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('parent_students')
      .select('*')
      .eq('parent_user_id', parentUserId)
      .order('created_at', { ascending: false });

    throwIfDbError(error);

    return this.hydrateAssociations((data || []) as unknown as ParentStudentRow[]);
  }

  async linkChild(parentUserId: string, input: LinkChildDto): Promise<ParentStudentDto> {
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

    // If this is marked as primary, unset other primary links
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
      })
      .select()
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to link child');
    }

    const row = data as ParentStudentRow;
    const children = await this.getChildren(parentUserId);
    return children.find((c) => c.id === row.id)!;
  }

  async unlinkChild(parentUserId: string, studentId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { error } = await supabase
      .from('parent_students')
      .delete()
      .eq('parent_user_id', parentUserId)
      .eq('student_id', studentId);

    throwIfDbError(error);
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

    // Apply pagination
    const { data, error, count } = await dbQuery
      .range(from, to)
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

