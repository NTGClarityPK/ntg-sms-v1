import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { StaffDto } from './dto/staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { DeactivateStaffDto } from './dto/deactivate-staff.dto';

type StaffRow = {
  id: string;
  user_id: string;
  branch_id: string;
  employee_id: string | null;
  department: string | null;
  join_date: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  created_at: string;
  updated_at: string;
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
export class StaffService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listStaff(query: QueryStaffDto, branchId: string): Promise<{
    data: StaffDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('staff')
      .select('*, profiles:user_id(full_name), user_roles!inner(role_id, branch_id, roles:role_id(id, name, display_name))', {
        count: 'exact',
      })
      .eq('branch_id', branchId)
      .eq('user_roles.branch_id', branchId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (query.isActive !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.isActive);
    }

    if (query.role) {
      dbQuery = dbQuery.eq('user_roles.role_id', query.role);
    }

    if (query.search) {
      dbQuery = dbQuery.or(
        `employee_id.ilike.%${query.search}%,profiles.full_name.ilike.%${query.search}%`,
      );
    }

    const { data, error, count } = await dbQuery;

    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Get user emails
    const userIds = (data as unknown as Array<{ user_id: string }>).map((s) => s.user_id);
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(
      authUsers.users
        .filter((u) => userIds.includes(u.id))
        .map((u) => [u.id, u.email || '']),
    );

    const staff = (data as unknown as Array<{
      id: string;
      user_id: string;
      branch_id: string;
      employee_id: string | null;
      department: string | null;
      join_date: string | null;
      is_active: boolean;
      deactivated_at: string | null;
      deactivation_reason: string | null;
      created_at: string;
      updated_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
      user_roles: Array<{
        role_id: string;
        branch_id: string;
        roles: RoleRow | RoleRow[] | null;
      }>;
    }>).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const roles = row.user_roles
        .filter((ur) => ur.branch_id === branchId)
        .map((ur) => {
          const role = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
          return role
            ? {
                roleId: ur.role_id,
                roleName: role.display_name,
                branchId: ur.branch_id,
              }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return new StaffDto({
        id: row.id,
        userId: row.user_id,
        branchId: row.branch_id,
        employeeId: row.employee_id ?? undefined,
        department: row.department ?? undefined,
        joinDate: row.join_date ?? undefined,
        isActive: row.is_active,
        deactivatedAt: row.deactivated_at ?? undefined,
        deactivationReason: row.deactivation_reason ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fullName: profile?.full_name,
        email: emailMap.get(row.user_id),
        roles,
      });
    });

    return {
      data: staff,
      meta: { total, page, limit, totalPages },
    };
  }

  async getStaffById(id: string, branchId: string): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('staff')
      .select(
        '*, profiles:user_id(full_name), user_roles(role_id, branch_id, roles:role_id(id, name, display_name))',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Staff member not found');
    }

    const row = data as unknown as {
      id: string;
      user_id: string;
      branch_id: string;
      employee_id: string | null;
      department: string | null;
      join_date: string | null;
      is_active: boolean;
      deactivated_at: string | null;
      deactivation_reason: string | null;
      created_at: string;
      updated_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
      user_roles: Array<{
        role_id: string;
        branch_id: string;
        roles: RoleRow | RoleRow[] | null;
      }>;
    };

    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const roles = row.user_roles
      .filter((ur) => ur.branch_id === branchId)
      .map((ur) => {
        const role = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
        return role
          ? {
              roleId: ur.role_id,
              roleName: role.display_name,
              branchId: ur.branch_id,
            }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);

    return new StaffDto({
      id: row.id,
      userId: row.user_id,
      branchId: row.branch_id,
      employeeId: row.employee_id ?? undefined,
      department: row.department ?? undefined,
      joinDate: row.join_date ?? undefined,
      isActive: row.is_active,
      deactivatedAt: row.deactivated_at ?? undefined,
      deactivationReason: row.deactivation_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      fullName: profile?.full_name,
      email: authUser.user?.email,
      roles,
    });
  }

  async createStaff(input: CreateStaffDto, branchId: string): Promise<StaffDto> {
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

      // Create staff record
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .insert({
          user_id: user.id,
          branch_id: branchId,
          employee_id: input.employeeId ?? null,
          department: input.department ?? null,
          join_date: input.joinDate ?? null,
          is_active: input.isActive ?? true,
        })
        .select()
        .single();

      throwIfDbError(staffError);
      if (!staff) {
        throw new BadRequestException('Failed to create staff record');
      }

      return this.getStaffById((staff as StaffRow).id, branchId);
    } catch (error) {
      // Rollback: delete auth user if staff creation fails
      await supabase.auth.admin.deleteUser(user.id);
      throw error;
    }
  }

  async updateStaff(id: string, input: UpdateStaffDto, branchId: string): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify staff exists in branch
    await this.getStaffById(id, branchId);

    // Update profile if needed
    if (
      input.fullName ||
      input.phone ||
      input.address ||
      input.dateOfBirth ||
      input.gender
    ) {
      const { data: staff } = await supabase
        .from('staff')
        .select('user_id')
        .eq('id', id)
        .single();

      if (staff) {
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
          .eq('id', (staff as { user_id: string }).user_id);

        throwIfDbError(profileError);
      }
    }

    // Update staff record
    const { error } = await supabase
      .from('staff')
      .update({
        employee_id: input.employeeId,
        department: input.department,
        join_date: input.joinDate,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    throwIfDbError(error);

    return this.getStaffById(id, branchId);
  }

  async deactivateStaff(
    id: string,
    input: DeactivateStaffDto,
    branchId: string,
  ): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();

    const staff = await this.getStaffById(id, branchId);

    // Check for assignments (will be implemented in Prompt 4)
    // For now, just deactivate
    const { error } = await supabase
      .from('staff')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: input.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    throwIfDbError(error);

    // TODO: Handle replacement logic when teacher_assignments table exists (Prompt 4)

    return this.getStaffById(id, branchId);
  }

  async getAssignments(id: string, branchId: string): Promise<{
    classTeacherOf: Array<{ classSectionId: string; className: string }>;
    subjectAssignments: Array<{ subjectId: string; subjectName: string; classSectionId: string }>;
  }> {
    // TODO: Implement when teacher_assignments and class_sections tables exist (Prompt 4)
    return {
      classTeacherOf: [],
      subjectAssignments: [],
    };
  }
}

