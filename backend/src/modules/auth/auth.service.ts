import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UserResponseDto } from './dto/user-response.dto';
import { BranchSummaryDto } from './dto/branch-summary.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseConfig: SupabaseConfig) {}

  private async listUserBranches(userId: string): Promise<BranchSummaryDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('user_branches')
      .select('branch_id, branches:branches(id, tenant_id, name, code)')
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const rowsUnknown = data ?? [];
    const rows = rowsUnknown as unknown as Array<{
      branch_id: string;
      branches:
        | { id: string; tenant_id: string | null; name: string; code: string | null }
        | { id: string; tenant_id: string | null; name: string; code: string | null }[]
        | null;
    }>;

    return rows
      .map((r) => {
        const b = r.branches;
        if (!b) return null;
        return Array.isArray(b) ? b[0] ?? null : b;
      })
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map(
        (b) =>
          new BranchSummaryDto({
            id: b.id,
            tenantId: b.tenant_id,
            name: b.name,
            code: b.code,
          }),
      );
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

    return new UserResponseDto({
      id: user.id,
      email: user.email || '',
      fullName: profile?.full_name || user.email || 'User',
      avatarUrl: profile?.avatar_url || undefined,
      roles: [], // Placeholder - will be populated later with role management
      branches,
      currentBranch,
    });
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
}

