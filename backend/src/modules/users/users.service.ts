import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { UserDto } from './dto/user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UserRoleRow = {
  user_id: string;
  role_id: string;
  branch_id: string;
  assigned_at: string;
};

type RoleRow = {
  id: string;
  name: string;
  display_name: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class UsersService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listUsers(query: QueryUsersDto, branchId: string): Promise<{
    data: UserDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Step 1: Get user IDs that have roles in this branch
    let userRolesQuery = supabase
      .from('user_roles')
      .select('user_id', { count: 'exact' })
      .eq('branch_id', branchId);

    if (query.role) {
      userRolesQuery = userRolesQuery.eq('role_id', query.role);
    }

    const { data: userRolesData, error: userRolesError, count } = await userRolesQuery;
    throwIfDbError(userRolesError);

    const userIds = Array.from(
      new Set((userRolesData || []).map((ur: { user_id: string }) => ur.user_id)),
    );

    if (userIds.length === 0) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    // Step 2: Fetch profiles for these users
    let profilesQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .in('id', userIds)
      .range(from, to);

    if (query.isActive !== undefined) {
      profilesQuery = profilesQuery.eq('is_active', query.isActive);
    }

    if (query.search) {
      profilesQuery = profilesQuery.or(
        `full_name.ilike.%${query.search}%,email.ilike.%${query.search}%`,
      );
    }

    const { data: profilesData, error: profilesError } = await profilesQuery;
    throwIfDbError(profilesError);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Step 3: Fetch user_roles for these users in this branch
    const profileIds = (profilesData || []).map((p: ProfileRow) => p.id);
    const { data: userRolesForBranch, error: userRolesBranchError } = await supabase
      .from('user_roles')
      .select('user_id, role_id, branch_id')
      .in('user_id', profileIds)
      .eq('branch_id', branchId);

    throwIfDbError(userRolesBranchError);

    // Step 4: Fetch roles data
    const roleIds = Array.from(
      new Set(
        (userRolesForBranch || []).map(
          (ur: { user_id: string; role_id: string; branch_id: string }) => ur.role_id,
        ),
      ),
    );
    const { data: rolesData, error: rolesError } =
      roleIds.length > 0
        ? await supabase
            .from('roles')
            .select('id, name, display_name')
            .in('id', roleIds)
        : { data: [], error: null };

    throwIfDbError(rolesError);
    const roleMap = new Map((rolesData || []).map((r: RoleRow) => [r.id, r]));

    // Step 5: Get user emails from auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(
      authUsers.users
        .filter((u) => profileIds.includes(u.id))
        .map((u) => [u.id, u.email || '']),
    );

    // Step 6: Combine the data
    const users = (profilesData || []).map((profile: ProfileRow) => {
      const userRolesForUser = (userRolesForBranch || []).filter(
        (ur: { user_id: string; role_id: string; branch_id: string }) =>
          ur.user_id === profile.id,
      );

      const roles = userRolesForUser
        .map((ur: { user_id: string; role_id: string; branch_id: string }) => {
          const role = roleMap.get(ur.role_id);
          return role
            ? {
                roleId: ur.role_id,
                roleName: role.display_name,
                branchId: ur.branch_id,
              }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return new UserDto({
        id: profile.id,
        email: emailMap.get(profile.id) || '',
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url ?? undefined,
        phone: profile.phone ?? undefined,
        address: profile.address ?? undefined,
        dateOfBirth: profile.date_of_birth ?? undefined,
        gender: profile.gender ?? undefined,
        isActive: profile.is_active,
        roles,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      });
    });

    return {
      data: users,
      meta: { total, page, limit, totalPages },
    };
  }

  async getUserById(id: string, branchId: string): Promise<UserDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify user has access to this branch
    const { data: userBranch } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!userBranch) {
      throw new NotFoundException('User not found in this branch');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    throwIfDbError(profileError);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    // Fetch user_roles separately (avoid relationship syntax)
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('role_id, branch_id')
      .eq('user_id', id)
      .eq('branch_id', branchId);

    throwIfDbError(userRolesError);

    // Fetch roles separately
    const roleIds = (userRoles || []).map(
      (ur: { role_id: string; branch_id: string }) => ur.role_id,
    );
    const { data: rolesData, error: rolesError } =
      roleIds.length > 0
        ? await supabase
            .from('roles')
            .select('id, name, display_name')
            .in('id', roleIds)
        : { data: [], error: null };

    throwIfDbError(rolesError);
    const roleMap = new Map((rolesData || []).map((r: RoleRow) => [r.id, r]));

    const roles = (userRoles || [])
      .map((ur: { role_id: string; branch_id: string }) => {
        const role = roleMap.get(ur.role_id);
        return role
          ? {
              roleId: ur.role_id,
              roleName: role.display_name,
              branchId: ur.branch_id,
            }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const { data: authUser } = await supabase.auth.admin.getUserById(id);

    const row = profile as ProfileRow;
    return new UserDto({
      id: row.id,
      email: authUser.user?.email || '',
      fullName: row.full_name,
      avatarUrl: row.avatar_url ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      dateOfBirth: row.date_of_birth ?? undefined,
      gender: row.gender ?? undefined,
      isActive: row.is_active,
      roles,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async createUser(input: CreateUserDto, branchId: string): Promise<UserDto> {
    const supabase = this.supabaseConfig.getClient();

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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: input.fullName,
          avatar_url: input.avatarUrl ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          date_of_birth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
          is_active: input.isActive ?? true,
        })
        .select()
        .single();

      throwIfDbError(profileError);
      if (!profile) {
        throw new BadRequestException('Failed to create profile');
      }

      // Assign to branch
      const { error: branchError } = await supabase.from('user_branches').insert({
        user_id: user.id,
        branch_id: branchId,
        is_primary: false,
      });

      if (branchError) {
        throw new BadRequestException(branchError.message);
      }

      // Assign roles if provided
      if (input.roleIds && input.roleIds.length > 0) {
        const roleAssignments = input.roleIds.map((roleId) => ({
          user_id: user.id,
          role_id: roleId,
          branch_id: branchId,
        }));

        const { error: rolesError } = await supabase.from('user_roles').insert(roleAssignments);

        if (rolesError) {
          throw new BadRequestException(rolesError.message);
        }
      }

      return this.getUserById(user.id, branchId);
    } catch (error) {
      // Rollback: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(user.id);
      throw error;
    }
  }

  async updateUser(id: string, input: UpdateUserDto, branchId: string): Promise<UserDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify user exists in branch
    await this.getUserById(id, branchId);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName,
        avatar_url: input.avatarUrl,
        phone: input.phone,
        address: input.address,
        date_of_birth: input.dateOfBirth,
        gender: input.gender,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    throwIfDbError(error);

    return this.getUserById(id, branchId);
  }

  async updateUserRoles(
    id: string,
    input: UpdateUserRolesDto,
    branchId: string,
  ): Promise<UserDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify user exists in branch
    await this.getUserById(id, branchId);

    // Delete existing roles for this branch
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', id)
      .eq('branch_id', branchId);

    throwIfDbError(deleteError);

    // Insert new roles
    if (input.roleIds.length > 0) {
      const roleAssignments = input.roleIds.map((roleId) => ({
        user_id: id,
        role_id: roleId,
        branch_id: branchId,
      }));

      const { error: insertError } = await supabase.from('user_roles').insert(roleAssignments);

      throwIfDbError(insertError);
    }

    return this.getUserById(id, branchId);
  }

  async deleteUser(id: string, branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Verify user exists in branch
    await this.getUserById(id, branchId);

    // Soft delete: set is_active = false
    const { error } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    throwIfDbError(error);
  }
}

