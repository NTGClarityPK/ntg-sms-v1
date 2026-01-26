import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UserResponseDto } from './dto/user-response.dto';
import { BranchSummaryDto } from './dto/branch-summary.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseConfig: SupabaseConfig) {}

  private async listUserBranches(userId: string): Promise<BranchSummaryDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // First get the branch IDs for this user
    const { data: userBranches, error: userBranchesError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);

    if (userBranchesError) {
      console.error('Error fetching user_branches:', userBranchesError);
      throw new BadRequestException(`Failed to fetch user branches: ${userBranchesError.message}`);
    }

    console.log('User branches query result:', { userId, userBranches });

    if (!userBranches || userBranches.length === 0) {
      console.log('No user_branches found for user:', userId);
      return [];
    }

    // Then fetch the branch details
    const branchIds = userBranches.map((ub) => ub.branch_id);
    console.log('Fetching branch details for IDs:', branchIds);
    
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, tenant_id, name, code')
      .in('id', branchIds);

    if (branchesError) {
      console.error('Error fetching branches:', branchesError);
      throw new BadRequestException(`Failed to fetch branches: ${branchesError.message}`);
    }

    console.log('Branches query result:', branches);

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
    
    console.log('Final branches result:', result);
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

    // Get user from auth.users
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    // Get profile from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for new users
      throw new NotFoundException('Profile not found');
    }

    const branches = await this.listUserBranches(userId);
    const currentBranchId = await this.getProfileCurrentBranchId(userId);
    const currentBranch = currentBranchId
      ? branches.find((b) => b.id === currentBranchId) ?? null
      : null;

    // Fetch user roles - use two-step approach for reliability
    const { data: userRolesData, error: userRolesError } = await supabase
      .from('user_roles')
      .select('role_id, branch_id')
      .eq('user_id', userId);

    let roles: Array<{ roleId: string; roleName: string; branchId: string }> = [];
    
    if (userRolesData && userRolesData.length > 0) {
      // Get unique role IDs
      const roleIds = Array.from(new Set(userRolesData.map((ur) => ur.role_id)));
      
      // Fetch role details
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('id, name')
        .in('id', roleIds);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      } else {
        // Create a map of role ID to role name
        const roleMap = new Map(
          (rolesData || []).map((r) => [r.id, r.name])
        );

        // Build roles array
        roles = userRolesData.map((ur) => ({
          roleId: ur.role_id,
          roleName: roleMap.get(ur.role_id) || '',
          branchId: ur.branch_id,
        }));
      }
    }

    const userResponse = new UserResponseDto({
      id: user.id,
      email: user.email || '',
      fullName: profile?.full_name || user.email || 'User',
      avatarUrl: profile?.avatar_url || undefined,
      roles,
      branches,
      currentBranch,
    });

    console.log('getCurrentUser - roles:', roles);
    console.log('getCurrentUser - branches:', branches);
    console.log('getCurrentUser - currentBranch:', currentBranch);
    
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
    fullName: string;
  } | null> {
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

    const { data: student } = await supabase
      .from('students')
      .select('id, student_id, profiles:user_id(full_name)')
      .eq('id', currentStudentId)
      .single();

    if (!student) {
      return null;
    }

    const studentData = student as unknown as {
      id: string;
      student_id: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
    };

    const profileData = Array.isArray(studentData.profiles)
      ? studentData.profiles[0]
      : studentData.profiles;

    return {
      id: studentData.id,
      studentId: studentData.student_id,
      fullName: profileData?.full_name || '',
    };
  }
}

