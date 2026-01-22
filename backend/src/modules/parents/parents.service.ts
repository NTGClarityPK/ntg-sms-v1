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

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class ParentsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async getChildren(parentUserId: string): Promise<ParentStudentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('parent_students')
      .select(
        '*, profiles:parent_user_id(full_name), students:student_id(id, student_id, profiles:user_id(full_name))',
      )
      .eq('parent_user_id', parentUserId)
      .order('created_at', { ascending: false });

    throwIfDbError(error);

    return (data as unknown as Array<{
      id: string;
      parent_user_id: string;
      student_id: string;
      relationship: 'father' | 'mother' | 'guardian';
      is_primary: boolean;
      can_approve: boolean;
      created_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
      students: {
        id: string;
        student_id: string;
        profiles: { full_name: string } | { full_name: string }[] | null;
      } | {
        id: string;
        student_id: string;
        profiles: { full_name: string } | { full_name: string }[] | null;
      }[] | null;
    }>).map((row) => {
      const parentProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const studentData = Array.isArray(row.students) ? row.students[0] : row.students;
      const studentProfile = studentData
        ? Array.isArray(studentData.profiles)
          ? studentData.profiles[0]
          : studentData.profiles
        : null;

      return new ParentStudentDto({
        id: row.id,
        parentUserId: row.parent_user_id,
        studentId: row.student_id,
        relationship: row.relationship,
        isPrimary: row.is_primary,
        canApprove: row.can_approve,
        createdAt: row.created_at,
        parentName: parentProfile?.full_name,
        studentName: studentProfile?.full_name,
        studentStudentId: studentData?.student_id,
      });
    });
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

    const { data } = await supabase
      .from('parent_students')
      .select(
        '*, profiles:parent_user_id(full_name), students:student_id(id, student_id, profiles:user_id(full_name))',
      )
      .eq('parent_user_id', userId)
      .eq('student_id', currentStudentId)
      .maybeSingle();

    if (!data) {
      return null;
    }

    const row = data as unknown as {
      id: string;
      parent_user_id: string;
      student_id: string;
      relationship: 'father' | 'mother' | 'guardian';
      is_primary: boolean;
      can_approve: boolean;
      created_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
      students: {
        id: string;
        student_id: string;
        profiles: { full_name: string } | { full_name: string }[] | null;
      } | null;
    };

    const parentProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const studentData = row.students;
    const studentProfile = studentData
      ? Array.isArray(studentData.profiles)
        ? studentData.profiles[0]
        : studentData.profiles
      : null;

    return new ParentStudentDto({
      id: row.id,
      parentUserId: row.parent_user_id,
      studentId: row.student_id,
      relationship: row.relationship,
      isPrimary: row.is_primary,
      canApprove: row.can_approve,
      createdAt: row.created_at,
      parentName: parentProfile?.full_name,
      studentName: studentProfile?.full_name,
      studentStudentId: studentData?.student_id,
    });
  }
}

