import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  isSupabaseConnectivityError,
  SUPABASE_CONNECTIVITY_USER_MESSAGE,
} from '../../common/utils/supabase-connectivity-error.util';
import { UserResponseDto } from './dto/user-response.dto';
import { BranchSummaryDto } from './dto/branch-summary.dto';
import { StudentTokenService } from '../../common/modules/student-token/student-token.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  private async getProfileBranchAndStudent(userId: string): Promise<{
    currentBranchId: string | null;
    currentStudentId: string | null;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('current_branch_id, current_student_id')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException(error.message);
    }

    const row = data as { current_branch_id: string | null; current_student_id: string | null } | null;
    return {
      currentBranchId: row?.current_branch_id ?? null,
      currentStudentId: row?.current_student_id ?? null,
    };
  }

  async getCurrentUser(
    userId: string,
    hint?: { email?: string; roleNames?: string[] },
  ): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    let resolvedEmail = (hint?.email ?? '').trim();
    const hintedRoleNames = hint?.roleNames ?? [];

    // Fallback: some internal code paths may call `getCurrentUser()` without going through JwtAuthGuard.
    // In that case, we still need the email for privileged checks and the response payload.
    if (!resolvedEmail) {
      let adminResult;
      try {
        adminResult = await supabase.auth.admin.getUserById(userId);
      } catch (e: unknown) {
        if (isSupabaseConnectivityError(e)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw e;
      }
      const { data, error } = adminResult;
      if (error) {
        if (isSupabaseConnectivityError(error)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new NotFoundException('User not found');
      }
      if (!data?.user) {
        throw new NotFoundException('User not found');
      }
      resolvedEmail = data.user.email ?? '';
    }

    // OPTIMISED: skip `auth.admin.getUserById` when email is already available from JwtAuthGuard.
    const [profileResult, userBranchesResult, userRolesResult] = await Promise.all([
      // Get profile from public.profiles (only needed fields)
      supabase
        .from('profiles')
        .select(
          'full_name, avatar_url, current_branch_id, preferred_locale, onboarding_seen_tours_modal, is_active',
        )
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

    const { data: profile, error: profileError } = profileResult;
    if (profileError && profileError.code !== 'PGRST116') {
      if (isSupabaseConnectivityError(profileError)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
      throw new NotFoundException('Profile not found');
    }

    const profileActiveFlag = (profile as { is_active?: boolean | null } | null)?.is_active;
    if (profileActiveFlag === false) {
      throw new ForbiddenException(
        'Your account has been marked as inactive by an administrator. Please contact your school if you need help.',
      );
    }

    const { data: userBranchesData, error: userBranchesError } = userBranchesResult;
    if (userBranchesError) {
      if (isSupabaseConnectivityError(userBranchesError)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
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
        ? supabase.from('branches').select('id, tenant_id, name, code, is_active').in('id', branchIds)
        : Promise.resolve({ data: [], error: null }),
      // Get role details (only if there are roles)
      roleIds.length > 0
        ? supabase.from('roles').select('id, name').in('id', roleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const { data: branchesData, error: branchesError } = branchesResult;
    if (branchesError) {
      if (isSupabaseConnectivityError(branchesError)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
      throw new BadRequestException(`Failed to fetch branches: ${branchesError.message}`);
    }

    const branchesRaw = (branchesData || []) as Array<{
      id: string;
      tenant_id: string | null;
      name: string | null;
      code: string | null;
      is_active: boolean;
    }>;

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

    const hasSuperAdminRole =
      roles.some((r) => (r.roleName || '').toLowerCase() === 'super_admin') ||
      hintedRoleNames.some((n) => (n || '').toLowerCase() === 'super_admin');

    const isPrivileged =
      hasSuperAdminRole ||
      resolvedEmail.endsWith('@ntg.com') ||
      resolvedEmail.endsWith('@example.com') ||
      resolvedEmail.endsWith('@ntgclarity.com') ||
      resolvedEmail.endsWith('@superuser.com');

    let filteredBranchesRaw = branchesRaw;
    if (!isPrivileged) {
      const tenantIds = Array.from(new Set(branchesRaw.map((b) => b.tenant_id).filter(Boolean))) as string[];
      const { data: tenantsData, error: tenantsError } =
        tenantIds.length > 0
          ? await supabase.from('tenants').select('id, is_active').in('id', tenantIds)
          : { data: [], error: null };

      if (tenantsError) {
        throw new BadRequestException(`Failed to fetch tenants: ${tenantsError.message}`);
      }

      const activeTenantIds = new Set(
        ((tenantsData || []) as Array<{ id: string; is_active: boolean }>)
          .filter((t) => t.is_active)
          .map((t) => t.id),
      );

      filteredBranchesRaw = branchesRaw.filter(
        (b) => b.is_active && !!b.tenant_id && activeTenantIds.has(b.tenant_id),
      );

      if (filteredBranchesRaw.length === 0) {
        throw new ForbiddenException(
          'Your school has been marked as inactive by an administrator. Please contact support if you need help.',
        );
      }
    }

    const branches = filteredBranchesRaw.map(
      (b) =>
        new BranchSummaryDto({
          id: b.id,
          tenantId: b.tenant_id,
          name: b.name ?? '',
          code: b.code,
        }),
    );

    if (resolvedEmail.endsWith('@superuser.com')) {
      const already = roles.some((r) => (r.roleName || '').toLowerCase() === 'super_admin');
      if (!already) {
        roles.push({
          roleId: '',
          roleName: 'super_admin',
          branchId: '',
        });
      }
    }

    const isStudentUser = roles.some((r) => (r.roleName || '').toLowerCase() === 'student');
    const isSchoolAdminUser = roles.some((r) => (r.roleName || '').toLowerCase() === 'school_admin');
    if (isStudentUser) {
      const { data: studentRows, error: studentRowsError } = await supabase
        .from('students')
        .select('is_active')
        .eq('user_id', userId);

      if (studentRowsError) {
        throw new BadRequestException(`Failed to verify student status: ${studentRowsError.message}`);
      }

      const rows = (studentRows || []) as Array<{ is_active: boolean }>;
      if (rows.length > 0 && rows.some((row) => !row.is_active)) {
        throw new ForbiddenException(
          'Your account has been marked as inactive by an administrator. Please contact your school if you need help.',
        );
      }
    }

    // Use current_branch_id from profile (already fetched, no extra query needed)
    let currentBranchId = (profile as { current_branch_id: string | null } | null)?.current_branch_id ?? null;

    // Auto-set current branch for users who have exactly one branch (e.g. non–school-admin roles
    // that skip the branch selection modal). Ensures BranchGuard and frontend have a branch without
    // requiring a separate select-branch call.
    if (!currentBranchId && branches.length === 1) {
      const defaultBranchId = branches[0].id;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_branch_id: defaultBranchId })
        .eq('id', userId);
      if (!updateError) {
        currentBranchId = defaultBranchId;
      }
    } else if (!currentBranchId && branches.length > 0 && !isSchoolAdminUser) {
      const defaultBranchId = branches[0].id;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_branch_id: defaultBranchId })
        .eq('id', userId);
      if (!updateError) {
        currentBranchId = defaultBranchId;
      }
    }

    if (currentBranchId && branches.length > 0 && !branches.some((b) => b.id === currentBranchId)) {
      const defaultBranchId = branches[0].id;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_branch_id: defaultBranchId })
        .eq('id', userId);
      if (!updateError) {
        currentBranchId = defaultBranchId;
      } else {
        currentBranchId = defaultBranchId;
      }
    }

    // Heuristic auto-correction:
    // Some users (e.g. subject teachers) can end up with `current_branch_id` pointing to a branch
    // that hasn't been configured (no assessment types), causing many "empty list" screens.
    // If the selected branch has no assessment types but another accessible branch does, switch.
    if (!isSchoolAdminUser && currentBranchId && branches.length > 1) {
      const { data: hasTypes } = await supabase
        .from('assessment_types')
        .select('id')
        .eq('branch_id', currentBranchId)
        .limit(1);

      if (!hasTypes || hasTypes.length === 0) {
        const branchIdsForFallback = branches.map((b) => b.id);
        const { data: anyAssessmentTypes, error: anyAssessmentTypesError } = await supabase
          .from('assessment_types')
          .select('branch_id')
          .in('branch_id', branchIdsForFallback)
          .limit(1);

        if (anyAssessmentTypesError) {
          throw new BadRequestException(
            `Failed to check assessment types for fallback branch: ${anyAssessmentTypesError.message}`,
          );
        }

        const fallbackBranchId = (anyAssessmentTypes?.[0] as { branch_id?: string } | null)?.branch_id ?? null;

        if (fallbackBranchId && fallbackBranchId !== currentBranchId) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ current_branch_id: fallbackBranchId })
            .eq('id', userId);
          if (!updateError) {
            currentBranchId = fallbackBranchId;
          } else {
            currentBranchId = fallbackBranchId;
          }
        }
      }
    }

    const currentBranch = currentBranchId
      ? branches.find((b) => b.id === currentBranchId) ?? null
      : null;

    const profileRow = profile as { preferred_locale?: string | null } | null;
    const userResponse = new UserResponseDto({
      id: userId,
      email: resolvedEmail,
      fullName: profile?.full_name || resolvedEmail || 'User',
      avatarUrl: profile?.avatar_url || undefined,
      preferredLocale: profileRow?.preferred_locale ?? 'en-US',
      onboardingSeenToursModal:
        (profile as { onboarding_seen_tours_modal?: boolean | null } | null)
          ?.onboarding_seen_tours_modal ?? false,
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

    return this.getCurrentUser(user.id, { email: user.email ?? '' });
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    const [authResult, profileResult] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase
        .from('profiles')
        .select('full_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const {
      data: { user },
      error: userError,
    } = authResult;

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const { data: profile, error: profileError } = profileResult;

    if (profileError && profileError.code !== 'PGRST116') {
      throw new BadRequestException(profileError.message);
    }

    const profileRow = profile as
      | {
          full_name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      | null;

    const fullName = profileRow?.full_name || user.email || 'User';
    const createdAt =
      profileRow?.created_at ||
      // Fallback to auth user created_at if available
      (user as { created_at?: string }).created_at ||
      new Date().toISOString();
    const updatedAt =
      profileRow?.updated_at ||
      (user as { updated_at?: string }).updated_at ||
      createdAt;

    return new ProfileResponseDto({
      id: user.id,
      email: user.email || '',
      fullName,
      createdAt,
      updatedAt,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    const trimmedName = dto.fullName?.trim();
    const shouldUpdateName = typeof trimmedName === 'string' && trimmedName.length > 0;
    const shouldUpdateSeen =
      typeof dto.onboardingSeenToursModal === 'boolean';

    if (!shouldUpdateName && !shouldUpdateSeen) {
      throw new BadRequestException('No profile fields provided');
    }

    // Important: `profiles.full_name` is NOT NULL in this database.
    // If we "upsert" a row without full_name and the profile doesn't exist yet, Postgres will try to INSERT
    // and fail. So:
    // - update when only toggling flags
    // - upsert only when we have a full_name value
    const profileWrite = shouldUpdateName
      ? supabase
          .from('profiles')
          .upsert(
            {
              id: userId,
              full_name: trimmedName,
              ...(shouldUpdateSeen
                ? { onboarding_seen_tours_modal: dto.onboardingSeenToursModal }
                : {}),
            },
            { onConflict: 'id' },
          )
      : supabase
          .from('profiles')
          .update({
            ...(shouldUpdateSeen
              ? { onboarding_seen_tours_modal: dto.onboardingSeenToursModal }
              : {}),
          })
          .eq('id', userId);

    const { data: profile, error: profileError } = await profileWrite
      .select('full_name, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new BadRequestException(profileError.message);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const profileRow = profile as
      | {
          full_name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      | null;

    const createdAt =
      profileRow?.created_at ||
      (user as { created_at?: string }).created_at ||
      new Date().toISOString();
    const updatedAt = profileRow?.updated_at || createdAt;

    return new ProfileResponseDto({
      id: user.id,
      email: user.email || '',
      fullName: profileRow?.full_name || user.email || 'User',
      createdAt,
      updatedAt,
    });
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

    const { currentBranchId, currentStudentId } = await this.getProfileBranchAndStudent(userId);
    if (!currentBranchId) {
      return null;
    }

    let studentIdToFetch: string | null = null;

    if (currentStudentId) {
      studentIdToFetch = currentStudentId;
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
      .eq('branch_id', currentBranchId)
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
      .select('id, student_id, first_name, last_name, branch_id, is_active')
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
      is_active: boolean;
    };

    if (row.is_active === false) {
      throw new ForbiddenException(
        'This student account has been marked as inactive by an administrator. Please contact your school if you need help.',
      );
    }

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

  /**
   * Ensure a Google-authenticated user has a tenant, branch, profile, and school_admin role.
   * Idempotent: if the user already has at least one branch, it will simply return the current user.
   */
  async bootstrapGoogleUser(userId: string): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // If user already has branches, nothing to do.
    const { data: existingUserBranches, error: userBranchesError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);

    if (userBranchesError) {
      throw new BadRequestException(`Failed to check user branches: ${userBranchesError.message}`);
    }

    if (existingUserBranches && existingUserBranches.length > 0) {
      return this.getCurrentUser(userId);
    }

    // Fetch auth user to get email/name
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const email = user.email || '';
    const fullName =
      (user.user_metadata as { full_name?: string; name?: string } | null)?.full_name ||
      (user.user_metadata as { name?: string } | null)?.name ||
      email ||
      'User';

    // Create tenant
    const random = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    const tenantCode = `GOOG${random}`;

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Default School',
        code: tenantCode,
        domain: null,
        is_active: true,
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      throw new BadRequestException(
        `Failed to create default tenant for Google user: ${tenantError?.message ?? 'Unknown error'}`,
      );
    }

    const tenantId = (tenant as { id: string }).id;

    // Create branch
    const branchCode = `${tenantCode}-MAIN`;
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        tenant_id: tenantId,
        name: 'Default Branch',
        code: branchCode,
        address: null,
        phone: null,
        email,
        storage_quota_gb: 100,
        is_active: true,
      })
      .select('id')
      .single();

    if (branchError || !branch) {
      throw new BadRequestException(
        `Failed to create default branch for Google user: ${branchError?.message ?? 'Unknown error'}`,
      );
    }

    const branchId = (branch as { id: string }).id;

    // Create default active academic year for the tenant
    const now = new Date();
    const y = now.getFullYear();
    const ayName = `${y}-${y + 1}`;
    const ayStart = `${y}-09-01`;
    const ayEnd = `${y + 1}-08-31`;
    await supabase.from('academic_years').insert({
      tenant_id: tenantId,
      name: ayName,
      start_date: ayStart,
      end_date: ayEnd,
      is_active: true,
      created_by: 'system',
      updated_by: 'system',
    });

    // Upsert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          is_active: true,
          current_branch_id: branchId,
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      throw new BadRequestException(`Failed to create profile for Google user: ${profileError.message}`);
    }

    // Link user to branch
    const { error: userBranchError } = await supabase.from('user_branches').insert({
      user_id: userId,
      branch_id: branchId,
      is_primary: true,
    });

    if (userBranchError) {
      throw new BadRequestException(
        `Failed to assign Google user to default branch: ${userBranchError.message}`,
      );
    }

    // Find school_admin role
    const { data: schoolAdminRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'school_admin')
      .maybeSingle();

    if (roleError) {
      throw new BadRequestException(`Failed to fetch school_admin role: ${roleError.message}`);
    }

    if (!schoolAdminRole) {
      throw new BadRequestException('School Admin role not found in database');
    }

    // Assign school_admin role scoped to the default branch
    const { error: roleAssignmentError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role_id: (schoolAdminRole as { id: string }).id,
      branch_id: branchId,
    });

    if (roleAssignmentError) {
      throw new BadRequestException(
        `Failed to assign school_admin role to Google user: ${roleAssignmentError.message}`,
      );
    }

    // Return full user payload
    return this.getCurrentUser(userId);
  }

  /**
   * Provision a Google-signup user using school/branch/admin info captured during signup.
   * Similar to bootstrapGoogleUser but uses explicit names instead of defaults.
   */
  async googleSignupProvision(
    userId: string,
    payload: { schoolName: string; branchName: string; fullName: string; phone?: string | null },
  ): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // If user already has branches, nothing to do.
    const { data: existingUserBranches, error: userBranchesError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);

    if (userBranchesError) {
      throw new BadRequestException(`Failed to check user branches: ${userBranchesError.message}`);
    }

    if (existingUserBranches && existingUserBranches.length > 0) {
      return this.getCurrentUser(userId);
    }

    const trimmedSchoolName = payload.schoolName?.trim();
    const trimmedBranchName = payload.branchName?.trim();
    const trimmedFullName = payload.fullName?.trim();

    if (!trimmedSchoolName || !trimmedBranchName || !trimmedFullName) {
      throw new BadRequestException('School name, branch name, and full name are required for Google signup.');
    }

    // Fetch auth user to get email
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const email = user.email || '';

    // Create tenant
    const random = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    const tenantCode = `GOOG${random}`;

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: trimmedSchoolName,
        code: tenantCode,
        domain: null,
        is_active: true,
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      throw new BadRequestException(
        `Failed to create tenant for Google signup: ${tenantError?.message ?? 'Unknown error'}`,
      );
    }

    const tenantId = (tenant as { id: string }).id;

    // Create branch
    const branchCode = `${tenantCode}-MAIN`;
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        tenant_id: tenantId,
        name: trimmedBranchName,
        code: branchCode,
        address: null,
        phone: payload.phone ?? null,
        email,
        storage_quota_gb: 100,
        is_active: true,
      })
      .select('id')
      .single();

    if (branchError || !branch) {
      throw new BadRequestException(
        `Failed to create branch for Google signup: ${branchError?.message ?? 'Unknown error'}`,
      );
    }

    const branchId = (branch as { id: string }).id;

    // Create default active academic year for the tenant
    const now = new Date();
    const y = now.getFullYear();
    const ayName = `${y}-${y + 1}`;
    const ayStart = `${y}-09-01`;
    const ayEnd = `${y + 1}-08-31`;
    await supabase.from('academic_years').insert({
      tenant_id: tenantId,
      name: ayName,
      start_date: ayStart,
      end_date: ayEnd,
      is_active: true,
      created_by: 'system',
      updated_by: 'system',
    });

    // Upsert profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: trimmedFullName,
          phone: payload.phone ?? null,
          is_active: true,
          current_branch_id: branchId,
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      throw new BadRequestException(`Failed to create profile for Google signup: ${profileError.message}`);
    }

    // Link user to branch
    const { error: userBranchError } = await supabase.from('user_branches').insert({
      user_id: userId,
      branch_id: branchId,
      is_primary: true,
    });

    if (userBranchError) {
      throw new BadRequestException(
        `Failed to assign Google signup user to branch: ${userBranchError.message}`,
      );
    }

    // Find school_admin role
    const { data: schoolAdminRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'school_admin')
      .maybeSingle();

    if (roleError) {
      throw new BadRequestException(`Failed to fetch school_admin role: ${roleError.message}`);
    }

    if (!schoolAdminRole) {
      throw new BadRequestException('School Admin role not found in database');
    }

    // Assign school_admin role scoped to the new branch
    const { error: roleAssignmentError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role_id: (schoolAdminRole as { id: string }).id,
      branch_id: branchId,
    });

    if (roleAssignmentError) {
      throw new BadRequestException(
        `Failed to assign school_admin role to Google signup user: ${roleAssignmentError.message}`,
      );
    }

    return this.getCurrentUser(userId);
  }
}
