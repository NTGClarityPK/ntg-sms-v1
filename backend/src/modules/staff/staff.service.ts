import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { StaffDto } from './dto/staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { DeactivateStaffDto } from './dto/deactivate-staff.dto';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';

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
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listStaff(query: QueryStaffDto, branchId: string): Promise<{
    data: StaffDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // First, get all staff IDs that match the role filter (if provided)
    let staffIdsForRoleFilter: string[] | null = null;
    if (query.role) {
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', query.role)
        .eq('branch_id', branchId);

      if (userRolesData && userRolesData.length > 0) {
        const userIdsWithRole = userRolesData.map((ur) => ur.user_id);
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('branch_id', branchId)
          .in('user_id', userIdsWithRole);

        staffIdsForRoleFilter = staffData?.map((s) => s.id) || [];
        if (staffIdsForRoleFilter.length === 0) {
          // No staff match the role filter
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 0 },
          };
        }
      } else {
        // No users have this role
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
    }

    // Build the main query
    let dbQuery = supabase
      .from('staff')
      .select(
        'id, user_id, branch_id, employee_id, department, join_date, is_active, deactivated_at, deactivation_reason, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (query.isActive !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.isActive);
    }

    if (staffIdsForRoleFilter) {
      dbQuery = dbQuery.in('id', staffIdsForRoleFilter);
    }

    const { data, error, count } = await dbQuery;

    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (!data || data.length === 0) {
      return {
        data: [],
        meta: { total, page, limit, totalPages },
      };
    }

    // Profiles + email from public.profiles (one query) — avoid Auth Admin getUserById storms on Nano.
    const userIds = (data as unknown as Array<{ user_id: string }>).map((s) => s.user_id);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_active, avatar_url, phone, address, date_of_birth')
      .in('id', userIds);

    const profileMap = new Map<string, string>();
    const emailMap = new Map<string, string>();
    const profileActiveMap = new Map<string, boolean>();
    const profileAvatarMap = new Map<string, string>();
    const profilePhoneMap = new Map<string, string>();
    const profileAddressMap = new Map<string, string>();
    const profileDobMap = new Map<string, string>();
    (profilesData || []).forEach((profile) => {
      profileMap.set(profile.id, profile.full_name || '');
      if (profile.email) emailMap.set(profile.id, profile.email);
      profileActiveMap.set(profile.id, profile.is_active !== false);
      if (profile.avatar_url) profileAvatarMap.set(profile.id, profile.avatar_url);
      if (profile.phone) profilePhoneMap.set(profile.id, profile.phone);
      if (profile.address) profileAddressMap.set(profile.id, profile.address);
      if (profile.date_of_birth) profileDobMap.set(profile.id, profile.date_of_birth);
    });

    // If search was provided, filter by profile name and employee_id client-side
    let filteredData = data;
    if (query.search && profilesData) {
      const searchLower = query.search.toLowerCase();
      filteredData = (data as unknown as Array<{ user_id: string; employee_id: string | null }>).filter((s) => {
        const profileName = profileMap.get(s.user_id) || '';
        const employeeId = s.employee_id || '';
        return (
          employeeId.toLowerCase().includes(searchLower) ||
          profileName.toLowerCase().includes(searchLower)
        );
      }) as typeof data;
      
      // Recalculate total if filtered
      if (filteredData.length !== data.length) {
        // For filtered results, we need to recalculate pagination
        // But since we already fetched a page, we'll just show what we have
        // In a production system, you'd want to refetch with the filter applied
      }
    }

    // Fetch user_roles separately
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('user_id, role_id, branch_id')
      .in('user_id', userIds)
      .eq('branch_id', branchId);

    // Get unique role IDs
    const roleIds = Array.from(
      new Set((userRolesData || []).map((ur) => ur.role_id)),
    );

    // Fetch role details
    const roleMap = new Map<string, RoleRow>();
    if (roleIds.length > 0) {
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name, display_name')
        .in('id', roleIds);

      if (rolesData) {
        rolesData.forEach((role) => {
          roleMap.set(role.id, role);
        });
      }
    }

    // Create a map of user_id to roles
    const userRolesMap = new Map<string, Array<{ roleId: string; roleName: string; branchId: string }>>();
    (userRolesData || []).forEach((ur) => {
      const role = roleMap.get(ur.role_id);
      if (role && ur.branch_id === branchId) {
        if (!userRolesMap.has(ur.user_id)) {
          userRolesMap.set(ur.user_id, []);
        }
        userRolesMap.get(ur.user_id)!.push({
          roleId: ur.role_id,
          roleName: role.name,
          branchId: ur.branch_id,
        });
      }
    });

    const staff = (filteredData as unknown as Array<{
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
    }>).map((row) => {
      const fullName = profileMap.get(row.user_id);
      const roles = userRolesMap.get(row.user_id) || [];
      const profileIsActive = profileActiveMap.get(row.user_id) ?? true;
      const effectiveIsActive = row.is_active && profileIsActive;

      return new StaffDto({
        id: row.id,
        userId: row.user_id,
        branchId: row.branch_id,
        employeeId: row.employee_id ?? undefined,
        department: row.department ?? undefined,
        joinDate: row.join_date ?? undefined,
        // Treat user as active only when BOTH staff row and profile are active.
        isActive: effectiveIsActive,
        deactivatedAt: row.deactivated_at ?? undefined,
        deactivationReason: row.deactivation_reason ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fullName,
        email: emailMap.get(row.user_id),
        roles,
        avatarUrl: profileAvatarMap.get(row.user_id),
        phone: profilePhoneMap.get(row.user_id),
        address: profileAddressMap.get(row.user_id),
        dateOfBirth: profileDobMap.get(row.user_id),
      });
    });

    // Honour query.isActive against the effective combined flag
    const finalStaff =
      query.isActive === undefined
        ? staff
        : staff.filter((s) => s.isActive === query.isActive);

    return {
      data: finalStaff,
      meta: { total, page, limit, totalPages },
    };
  }

  async getStaffByUserId(userId: string, branchId: string): Promise<StaffDto | null> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('staff')
      .select('id, user_id, branch_id, employee_id, department, join_date, is_active, deactivated_at, deactivation_reason, created_at, updated_at')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) {
      return null;
    }

    return this.getStaffById((data as StaffRow).id, branchId);
  }

  async getStaffById(id: string, branchId: string): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('staff')
      .select('id, user_id, branch_id, employee_id, department, join_date, is_active, deactivated_at, deactivation_reason, created_at, updated_at')
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
    };

    // Fetch profile separately
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, phone, address, date_of_birth')
      .eq('id', row.user_id)
      .single();

    const fullName = profileData?.full_name || undefined;

    // Fetch user_roles separately
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('role_id, branch_id')
      .eq('user_id', row.user_id)
      .eq('branch_id', branchId);

    // Get unique role IDs
    const roleIds = Array.from(
      new Set((userRolesData || []).map((ur) => ur.role_id)),
    );

    // Fetch role details
    const roleMap = new Map<string, RoleRow>();
    if (roleIds.length > 0) {
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name, display_name')
        .in('id', roleIds);

      if (rolesData) {
        rolesData.forEach((role) => {
          roleMap.set(role.id, role);
        });
      }
    }

    // Build roles array
    const roles = (userRolesData || [])
      .map((ur) => {
        const role = roleMap.get(ur.role_id);
        return role
          ? {
              roleId: ur.role_id,
              roleName: role.name,
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
        fullName,
        email: authUser.user?.email,
        roles,
        avatarUrl: profileData?.avatar_url ?? undefined,
        phone: profileData?.phone ?? undefined,
        address: profileData?.address ?? undefined,
        dateOfBirth: profileData?.date_of_birth ?? undefined,
      });
  }

  async createStaff(input: CreateStaffDto, branchId: string, userEmail: string): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

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
        throw new ConflictException('A user with this email address already exists.');
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

      // Assign roles if provided
      if (input.roleIds && input.roleIds.length > 0) {
        const roleAssignments = input.roleIds.map((roleId) => ({
          user_id: user.id,
          role_id: roleId,
          branch_id: branchId,
          created_by: username,
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
          created_by: username,
          updated_by: username,
        })
        .select()
        .single();

      throwIfDbError(staffError);
      if (!staff) {
        throw new BadRequestException('Failed to create staff record');
      }

      const staffRow = staff as StaffRow;
      this.auditLogService
        .logCreate('staff', staffRow.id, userEmail, { ...staffRow } as Record<string, unknown>, {
          branchId,
        })
        .catch(() => {});

      return this.getStaffById(staffRow.id, branchId);
    } catch (error) {
      // Rollback: delete auth user if staff creation fails
      await supabase.auth.admin.deleteUser(user.id);
      throw error;
    }
  }

  async updateStaff(id: string, input: UpdateStaffDto, branchId: string, userEmail: string): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    const { data: oldRow, error: fetchError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(fetchError);
    if (!oldRow) {
      throw new NotFoundException('Staff not found');
    }

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
            updated_by: username,
          })
          .eq('id', (staff as { user_id: string }).user_id);

        throwIfDbError(profileError);
      }
    }

    const staffUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: username,
    };
    if (input.employeeId !== undefined) staffUpdates.employee_id = input.employeeId;
    if (input.department !== undefined) staffUpdates.department = input.department;
    if (input.joinDate !== undefined) staffUpdates.join_date = input.joinDate;
    if (input.isActive !== undefined) staffUpdates.is_active = input.isActive;

    const { data: newRow, error } = await supabase
      .from('staff')
      .update(staffUpdates)
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);
    if (newRow) {
      const changedFields = Object.keys(staffUpdates).filter((k) => k !== 'updated_at');
      this.auditLogService
        .logUpdate(
          'staff',
          id,
          userEmail,
          { ...oldRow } as Record<string, unknown>,
          { ...newRow } as Record<string, unknown>,
          changedFields,
          { branchId },
        )
        .catch(() => {});
    }

    return this.getStaffById(id, branchId);
  }

  async deactivateStaff(
    id: string,
    input: DeactivateStaffDto,
    branchId: string,
    userEmail: string,
  ): Promise<StaffDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    const { data: oldRow, error: fetchError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(fetchError);
    if (!oldRow) {
      throw new NotFoundException('Staff not found');
    }

    const { data: newRow, error } = await supabase
      .from('staff')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: input.reason,
        updated_at: new Date().toISOString(),
        updated_by: username,
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);
    if (newRow) {
      this.auditLogService
        .logUpdate(
          'staff',
          id,
          userEmail,
          { ...oldRow } as Record<string, unknown>,
          { ...newRow } as Record<string, unknown>,
          ['is_active', 'deactivated_at', 'deactivation_reason', 'updated_at', 'updated_by'],
          { branchId },
        )
        .catch(() => {});
    }

    return this.getStaffById(id, branchId);
  }

  async getAssignments(id: string, branchId: string): Promise<{
    classTeacherOf: Array<{ classSectionId: string; className: string; sectionName: string }>;
    subjectAssignments: Array<{ subjectId: string; subjectName: string; classSectionId: string }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Get class sections where this staff is the class teacher
    const { data: classSections, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id, classes:class_id(name, display_name), sections:section_id(name)')
      .eq('class_teacher_id', id)
      .eq('branch_id', branchId)
      .eq('is_active', true);
    throwIfDbError(csError);

    const classTeacherOf = (classSections || []).map((cs) => {
      const classData = Array.isArray(cs.classes) ? cs.classes[0] : cs.classes;
      const sectionData = Array.isArray(cs.sections) ? cs.sections[0] : cs.sections;
      return {
        classSectionId: cs.id,
        className: classData?.display_name || classData?.name || 'Unknown',
        sectionName: sectionData?.name || 'Unknown',
      };
    });

    // Get subject assignments
    const { data: teacherAssignments, error: taError } = await supabase
      .from('teacher_assignments')
      .select('subject_id, class_section_id, subjects:subject_id(name)')
      .eq('staff_id', id)
      .eq('branch_id', branchId);
    throwIfDbError(taError);

    const subjectAssignments = (teacherAssignments || []).map((ta) => {
      const subjectData = Array.isArray(ta.subjects) ? ta.subjects[0] : ta.subjects;
      return {
        subjectId: ta.subject_id,
        subjectName: subjectData?.name || 'Unknown',
        classSectionId: ta.class_section_id,
      };
    });

    return {
      classTeacherOf,
      subjectAssignments,
    };
  }
}

