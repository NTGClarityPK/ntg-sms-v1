import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UserResponseDto } from './dto/user-response.dto';
import { BranchSummaryDto } from './dto/branch-summary.dto';
import { StudentTokenService } from '../../common/modules/student-token/student-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly studentTokenService: StudentTokenService,
  ) {}

  private async listUserBranches(userId: string): Promise<BranchSummaryDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // First get the branch IDs for this user
    const { data: userBranches, error: userBranchesError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);

    if (userBranchesError) {
      throw new BadRequestException(`Failed to fetch user branches: ${userBranchesError.message}`);
    }

    if (!userBranches || userBranches.length === 0) {
      return [];
    }

    // Then fetch the branch details
    const branchIds = userBranches.map((ub) => ub.branch_id);
    
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, tenant_id, name, code')
      .in('id', branchIds);

    if (branchesError) {
      throw new BadRequestException(`Failed to fetch branches: ${branchesError.message}`);
    }

    if (!branches) {
      return [];
    }

    const result = branches.map(
      (b) =>
        new BranchSummaryDto({
          id: b.id,
          tenantId: b.tenant_id,
          name: b.name,
          code: b.code,
        }),
    );
    
    return result;
  }

  private async getProfileCurrentBranchId(userId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('current_branch_id')
      .eq('id', userId)
      .maybeSingle();

    // PGRST116 is "not found" which is okay for new users
    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException(error.message);
    }

    const row = data as { current_branch_id: string | null } | null;
    return row?.current_branch_id ?? null;
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // OPTIMISED: Run all independent queries in parallel (first batch)
    const [authResult, profileResult, userBranchesResult, userRolesResult] = await Promise.all([
      // Get user from auth.users
      supabase.auth.admin.getUserById(userId),
      // Get profile from public.profiles (only needed fields)
      supabase
        .from('profiles')
        .select('full_name, avatar_url, current_branch_id, preferred_locale')
        .eq('id', userId)
        .maybeSingle(),
      // Get user branch mappings
      supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', userId),
      // Get user role mappings
      supabase
        .from('user_roles')
        .select('role_id, branch_id')
        .eq('user_id', userId),
    ]);

    const { data: { user }, error: userError } = authResult;
    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const { data: profile, error: profileError } = profileResult;
    if (profileError && profileError.code !== 'PGRST116') {
      throw new NotFoundException('Profile not found');
    }

    const { data: userBranchesData, error: userBranchesError } = userBranchesResult;
    if (userBranchesError) {
      throw new BadRequestException(`Failed to fetch user branches: ${userBranchesError.message}`);
    }

    const { data: userRolesData } = userRolesResult;

    // Extract IDs for second batch
    const branchIds = (userBranchesData || []).map((ub) => ub.branch_id);
    const roleIds = Array.from(new Set((userRolesData || []).map((ur) => ur.role_id)));

    // OPTIMISED: Run dependent queries in parallel (second batch)
    const [branchesResult, rolesResult] = await Promise.all([
      // Get branch details (only if there are branches)
      branchIds.length > 0
        ? supabase.from('branches').select('id, tenant_id, name, code').in('id', branchIds)
        : Promise.resolve({ data: [], error: null }),
      // Get role details (only if there are roles)
      roleIds.length > 0
        ? supabase.from('roles').select('id, name').in('id', roleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const { data: branchesData, error: branchesError } = branchesResult;
    if (branchesError) {
      throw new BadRequestException(`Failed to fetch branches: ${branchesError.message}`);
    }

    const branches = (branchesData || []).map(
      (b) =>
        new BranchSummaryDto({
          id: b.id,
          tenantId: b.tenant_id,
          name: b.name,
          code: b.code,
        }),
    );

    // Build roles array
    let roles: Array<{ roleId: string; roleName: string; branchId: string }> = [];
    if (userRolesData && userRolesData.length > 0 && !rolesResult.error) {
      const roleMap = new Map((rolesResult.data || []).map((r) => [r.id, r.name]));
      roles = userRolesData.map((ur) => ({
        roleId: ur.role_id,
        roleName: roleMap.get(ur.role_id) || '',
        branchId: ur.branch_id,
      }));
    }

    // Use current_branch_id from profile (already fetched, no extra query needed)
    const currentBranchId = (profile as { current_branch_id: string | null } | null)?.current_branch_id ?? null;
    const currentBranch = currentBranchId
      ? branches.find((b) => b.id === currentBranchId) ?? null
      : null;

    const profileRow = profile as { preferred_locale?: string | null } | null;
    const userResponse = new UserResponseDto({
      id: user.id,
      email: user.email || '',
      fullName: profile?.full_name || user.email || 'User',
      avatarUrl: profile?.avatar_url || undefined,
      preferredLocale: profileRow?.preferred_locale ?? 'ar',
      roles,
      branches,
      currentBranch,
    });
    
    return userResponse;
  }

  async validateToken(token: string): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify token and get user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new NotFoundException('Invalid token');
    }

    return this.getCurrentUser(user.id);
  }

  async getMyBranches(userId: string): Promise<BranchSummaryDto[]> {
    return this.listUserBranches(userId);
  }

  async selectBranch(userId: string, branchId: string): Promise<BranchSummaryDto> {
    const supabase = this.supabaseConfig.getClient();

    const branches = await this.listUserBranches(userId);
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) {
      throw new BadRequestException('You do not have access to this branch');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ current_branch_id: branchId })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return branch;
  }

  async getCurrentBranch(userId: string): Promise<BranchSummaryDto | null> {
    const currentBranchId = await this.getProfileCurrentBranchId(userId);
    if (!currentBranchId) return null;

    const branches = await this.listUserBranches(userId);
    return branches.find((b) => b.id === currentBranchId) ?? null;
  }

  async selectChild(userId: string, studentId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Verify user has access to this student (via parent_students)
    const { data: link } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!link) {
      throw new BadRequestException('You do not have access to this student');
    }

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ current_student_id: studentId })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getCurrentChild(userId: string): Promise<{
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
  } | null> {
    const supabase = this.supabaseConfig.getClient();

    // Get user's current branch from profile
    const currentBranchId = await this.getProfileCurrentBranchId(userId);
    if (!currentBranchId) {
      return null;
    }

    // First, check if user has a current_student_id set (for parents)
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_student_id')
      .eq('id', userId)
      .maybeSingle();

    let studentIdToFetch: string | null = null;

    if (profile && (profile as { current_student_id: string | null }).current_student_id) {
      // Parent has selected a child - verify it's in the current branch
      const { data: studentCheck } = await supabase
        .from('students')
        .select('id')
        .eq('id', (profile as { current_student_id: string }).current_student_id)
        .eq('branch_id', currentBranchId)
        .maybeSingle();

      if (studentCheck) {
        studentIdToFetch = studentCheck.id;
      }
    } else {
      // No current_student_id set - check if user is a student themselves
      // (student record linked directly to user_id) - filter by current branch
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .eq('branch_id', currentBranchId)
        .maybeSingle();

      if (studentRecord) {
        studentIdToFetch = studentRecord.id;
      }
    }

    if (!studentIdToFetch) {
      return null;
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_id, user_id, first_name, last_name')
      .eq('id', studentIdToFetch)
      .single();

    if (studentError || !student) {
      return null;
    }

    const row = student as { id: string; student_id: string; first_name: string | null; last_name: string | null };
    return {
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
    };
  }

  async listMyChildren(userId: string): Promise<
    Array<{
      id: string;
      studentId: string;
      firstName: string;
      lastName: string;
      branchId: string | null;
      isCurrent: boolean;
    }>
  > {
    const supabase = this.supabaseConfig.getClient();

    const [{ data: profile }, { data: links, error: linksError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('current_student_id')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id', userId),
    ]);

    if (linksError) {
      throw new BadRequestException(`Failed to fetch children: ${linksError.message}`);
    }

    const studentIds = (links || []).map((l) => (l as { student_id: string }).student_id);
    if (studentIds.length === 0) {
      return [];
    }

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name, branch_id')
      .in('id', studentIds);

    if (studentsError) {
      throw new BadRequestException(`Failed to fetch students: ${studentsError.message}`);
    }

    const currentStudentId =
      (profile as { current_student_id: string | null } | null)?.current_student_id ?? null;

    return (students || []).map((s) => {
      const row = s as {
        id: string;
        student_id: string;
        first_name: string | null;
        last_name: string | null;
        branch_id: string | null;
      };
      return {
        id: row.id,
        studentId: row.student_id,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        branchId: row.branch_id,
        isCurrent: currentStudentId === row.id,
      };
    });
  }

  async verifyChildEmail(parentUserId: string, studentId: string, email: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError) {
      throw new BadRequestException('Failed to verify child credentials.');
    }

    const studentRow = student as { user_id: string | null } | null;
    if (!studentRow || !studentRow.user_id) {
      throw new BadRequestException('Failed to verify child credentials.');
    }

    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(
      studentRow.user_id,
    );

    const actualEmail = userResult?.user?.email;
    if (userError || !actualEmail) {
      throw new BadRequestException('Failed to verify child credentials.');
    }

    const normalizedProvided = email.trim().toLowerCase();
    const normalizedActual = actualEmail.trim().toLowerCase();

    if (normalizedProvided !== normalizedActual) {
      throw new BadRequestException('Failed to verify child credentials.');
    }
  }

  async switchChild(userId: string, studentId: string): Promise<{
    token: string;
    student: {
      id: string;
      studentId: string;
      firstName: string;
      lastName: string;
      branchId: string | null;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: link } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!link) {
      throw new BadRequestException('You do not have access to this student');
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name, branch_id')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError || !student) {
      throw new BadRequestException('Student not found');
    }

    const row = student as {
      id: string;
      student_id: string;
      first_name: string | null;
      last_name: string | null;
      branch_id: string | null;
    };

    // Keep existing behaviour of storing current_student_id for convenience
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ current_student_id: row.id })
      .eq('id', userId);

    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    const token = this.studentTokenService.mintStudentToken({
      studentId: row.id,
      branchId: row.branch_id ?? '',
    });

    return {
      token,
      student: {
        id: row.id,
        studentId: row.student_id,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        branchId: row.branch_id,
      },
    };
  }
}
