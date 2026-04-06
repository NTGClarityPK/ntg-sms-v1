import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TenantDto } from './dto/tenant.dto';
import { TenantStatisticsDto, TenantAdminInfo } from './dto/tenant-statistics.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type TenantRow = {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  fiscal_year_start: string | null;
  vat_number: string | null;
  is_active: boolean;
  logo_url: string | null;
  deletion_status: 'none' | 'pending' | 'executing' | null;
  deletion_requested_at: string | null;
  deletion_execute_at: string | null;
  deletion_cancelled_at: string | null;
  deletion_requested_by: string | null;
  pre_deletion_is_active: boolean | null;
};

type SystemSettingRow = {
  key: string;
  value: unknown;
};

function mapTenant(row: TenantRow, primaryColor?: string | null): TenantDto {
  return new TenantDto({
    id: row.id,
    name: row.name,
    code: row.code,
    domain: row.domain,
    email: row.email,
    phone: row.phone,
    timezone: row.timezone,
    fiscalYearStart: row.fiscal_year_start,
    vatNumber: row.vat_number,
    isActive: row.is_active,
    logoUrl: row.logo_url,
    primaryColor: primaryColor ?? null,
    deletionStatus: row.deletion_status ?? 'none',
    deletionRequestedAt: row.deletion_requested_at,
    deletionExecuteAt: row.deletion_execute_at,
    deletionCancelledAt: row.deletion_cancelled_at,
    deletionRequestedBy: row.deletion_requested_by,
    preDeletionIsActive: row.pre_deletion_is_active,
  });
}

const TENANT_SELECT =
  'id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, is_active, logo_url, deletion_status, deletion_requested_at, deletion_execute_at, deletion_cancelled_at, deletion_requested_by, pre_deletion_is_active';

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getThemeSettingKey(tenantId: string): string {
    return `tenant_theme_primary_color:${tenantId}`;
  }

  async getMe(tenantId: string | null): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('tenants')
      .select(TENANT_SELECT)
      .eq('id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Tenant not found');

    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();

    throwIfDbError(themeError);
    const primaryColor =
      (themeSetting as SystemSettingRow | null)?.value &&
      typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }

  async updateMe(
    tenantId: string | null,
    updates: {
      name?: string;
      domain?: string;
      email?: string;
      phone?: string;
      timezone?: string;
      fiscalYearStart?: string;
      vatNumber?: string;
      primaryColor?: string;
    },
    userEmail: string,
  ): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    const hasTenantUpdates =
      updates.name !== undefined ||
      updates.domain !== undefined ||
      updates.email !== undefined ||
      updates.phone !== undefined ||
      updates.timezone !== undefined ||
      updates.fiscalYearStart !== undefined ||
      updates.vatNumber !== undefined;
    
    if (!hasTenantUpdates && !updates.primaryColor) {
      throw new BadRequestException('No fields to update');
    }

    const supabase = this.supabaseConfig.getClient();
    let tenantData: TenantRow | null = null;

    if (hasTenantUpdates) {
      const { data: oldRow } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      const updateData: Partial<TenantRow> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.domain !== undefined) updateData.domain = updates.domain || null;
      if (updates.email !== undefined) updateData.email = updates.email || null;
      if (updates.phone !== undefined) updateData.phone = updates.phone || null;
      if (updates.timezone !== undefined) updateData.timezone = updates.timezone || null;
      if (updates.fiscalYearStart !== undefined) updateData.fiscal_year_start = updates.fiscalYearStart || null;
      if (updates.vatNumber !== undefined) updateData.vat_number = updates.vatNumber || null;
      const { data, error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', tenantId)
        .select(TENANT_SELECT)
        .single();

      throwIfDbError(error);
      tenantData = data as TenantRow;
      if (oldRow && data) {
        const changedFields = Object.keys(updateData) as string[];
        this.auditLogService
          .logUpdate(
            'tenants',
            tenantId,
            userEmail,
            oldRow as Record<string, unknown>,
            data as Record<string, unknown>,
            changedFields,
            { tenantId },
          )
          .catch(() => {});
      }
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .select(TENANT_SELECT)
        .eq('id', tenantId)
        .single();
      throwIfDbError(error);
      tenantData = data as TenantRow;
    }

    let primaryColor: string | null = null;
    if (updates.primaryColor) {
      const themeSettingKey = this.getThemeSettingKey(tenantId);
      const { error: upsertThemeError } = await supabase.from('system_settings').upsert(
        {
          key: themeSettingKey,
          value: updates.primaryColor,
        },
        { onConflict: 'key' },
      );
      throwIfDbError(upsertThemeError);
      primaryColor = updates.primaryColor;
    } else {
      const themeSettingKey = this.getThemeSettingKey(tenantId);
      const { data: themeSetting, error: themeError } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', themeSettingKey)
        .maybeSingle();
      throwIfDbError(themeError);
      if (themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string') {
        primaryColor = (themeSetting as SystemSettingRow).value as string;
      }
    }

    return { data: mapTenant(tenantData, primaryColor) };
  }

  async uploadLogo(
    tenantId: string | null,
    file: UploadedLogoFile,
    userEmail: string,
  ): Promise<{ data: TenantDto }> {
    if (!tenantId) throw new BadRequestException('Tenant not resolved from branch');
    if (!file) throw new BadRequestException('Logo file is required');

    const supabase = this.supabaseConfig.getClient();
    const { data: oldRow } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    const extension = (file.originalname.split('.').pop() || 'png').toLowerCase();
    const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('school-logos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new BadRequestException(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('school-logos').getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('tenants')
      .update({ logo_url: publicUrl })
      .eq('id', tenantId)
      .select(TENANT_SELECT)
      .single();

    throwIfDbError(error);
    if (oldRow && data) {
      this.auditLogService
        .logUpdate(
          'tenants',
          tenantId,
          userEmail,
          oldRow as Record<string, unknown>,
          data as Record<string, unknown>,
          ['logo_url'],
          { tenantId },
        )
        .catch(() => {});
    }
    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();
    throwIfDbError(themeError);
    const primaryColor =
      themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }

  async listAll(): Promise<{ data: TenantDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('tenants')
      .select(TENANT_SELECT)
      .order('name', { ascending: true });

    throwIfDbError(error);

    // Get primary colors for all tenants
    const tenantIds = (data || []).map((t: TenantRow) => t.id);
    const themeSettingKeys = tenantIds.map((id: string) => this.getThemeSettingKey(id));

    const { data: themeSettings, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', themeSettingKeys);

    throwIfDbError(themeError);

    const colorMap = new Map<string, string | null>();
    (themeSettings || []).forEach((setting: SystemSettingRow) => {
      const tenantId = setting.key.replace('tenant_theme_primary_color:', '');
      const color =
        setting.value && typeof setting.value === 'string' ? (setting.value as string) : null;
      colorMap.set(tenantId, color);
    });

    return {
      data: (data || []).map((row: TenantRow) => mapTenant(row, colorMap.get(row.id) ?? null)),
    };
  }

  async getTenantStatistics(): Promise<{ data: TenantStatisticsDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Get all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, code, domain, email, phone, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    throwIfDbError(tenantsError);

    if (!tenants || tenants.length === 0) {
      return { data: [] };
    }

    type TenantBasicInfo = {
      id: string;
      name: string;
      code: string;
      domain: string | null;
      email: string | null;
      phone: string | null;
    };

    const tenantIds = (tenants as TenantBasicInfo[]).map((t) => t.id);

    // Get all branches per tenant
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, tenant_id, is_active')
      .in('tenant_id', tenantIds)
      .eq('is_active', true);

    throwIfDbError(branchesError);

    const branchIds = (branches || []).map((b: { id: string; tenant_id: string }) => b.id);
    const branchesByTenant = new Map<string, string[]>();
    (branches || []).forEach((b: { id: string; tenant_id: string }) => {
      if (!branchesByTenant.has(b.tenant_id)) {
        branchesByTenant.set(b.tenant_id, []);
      }
      branchesByTenant.get(b.tenant_id)!.push(b.id);
    });

    // Get role IDs in parallel
    const [adminRoleResult, studentRoleResult, staffRolesResult] = await Promise.all([
      supabase.from('roles').select('id').eq('name', 'school_admin').maybeSingle(),
      supabase.from('roles').select('id').eq('name', 'student').maybeSingle(),
      supabase
        .from('roles')
        .select('id')
        .in('name', [
          'class_teacher',
          'subject_teacher',
          'principal',
          'academic_coordinator',
          'admin_assistant',
          'guidance_counselor',
        ]),
    ]);

    throwIfDbError(adminRoleResult.error);
    throwIfDbError(studentRoleResult.error);
    throwIfDbError(staffRolesResult.error);

    const adminRoleId = (adminRoleResult.data as { id: string } | null)?.id;
    const studentRoleId = (studentRoleResult.data as { id: string } | null)?.id;
    const staffRoleIds = ((staffRolesResult.data || []) as { id: string }[]).map((r) => r.id);

    // Fetch school_admin user_roles separately (small set, avoids PostgREST row caps on big datasets)
    const { data: adminUserRolesRows, error: adminUserRolesError } = adminRoleId
      ? await supabase
          .from('user_roles')
          .select('user_id, branch_id')
          .eq('role_id', adminRoleId)
          .in('branch_id', branchIds)
          .range(0, 5000)
      : { data: [], error: null };

    throwIfDbError(adminUserRolesError);

    // Get all users with roles in branches (for user count)
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role_id, branch_id')
      .in('branch_id', branchIds)
      // PostgREST can default to returning only ~1000 rows; explicitly request a larger range
      // so tenant statistics (incl. school admins) are complete.
      .range(0, 5000);

    throwIfDbError(userRolesError);

    // Get all students (for student count)
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, branch_id, is_active, user_id')
      .in('branch_id', branchIds);

    throwIfDbError(studentsError);

    // Get all unique admin user IDs across all tenants (for fetching emails)
    const allAdminUserIds = new Set<string>();
    (tenants as TenantBasicInfo[]).forEach((tenant) => {
      const tenantBranchIds = branchesByTenant.get(tenant.id) || [];
      const tenantAdminUserRoles = (adminUserRolesRows || []).filter((ur: { branch_id: string }) =>
        tenantBranchIds.includes(ur.branch_id),
      );
      tenantAdminUserRoles.forEach((ur: { user_id: string }) => allAdminUserIds.add(ur.user_id));
    });

    // Fetch profiles + emails for admin users (batch, reliable)
    const adminUserIdsArray = Array.from(allAdminUserIds);
    const [profilesResult, emailsResult] = await Promise.all([
      adminUserIdsArray.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', adminUserIdsArray)
        : Promise.resolve({ data: [], error: null }),
      adminUserIdsArray.length > 0
        ? supabase.rpc('get_auth_user_emails', { p_user_ids: adminUserIdsArray })
        : Promise.resolve({ data: [], error: null }),
    ]);

    throwIfDbError(profilesResult.error);
    throwIfDbError((emailsResult as { error: PostgrestError | null }).error);

    const profileMap = new Map<string, string | null>();
    ((profilesResult.data || []) as { id: string; full_name: string | null }[]).forEach((p) => {
      profileMap.set(p.id, p.full_name);
    });

    const authUserMap = new Map<string, string>();
    (((emailsResult as { data: Array<{ id: string; email: string | null }> | null }).data || []) as Array<{
      id: string;
      email: string | null;
    }>).forEach((row) => {
      if (row.email) authUserMap.set(row.id, row.email);
    });

    // Build statistics per tenant
    const statistics: TenantStatisticsDto[] = (tenants as TenantBasicInfo[]).map((tenant) => {
      const tenantBranchIds = branchesByTenant.get(tenant.id) || [];

      // Count users (excluding students)
      const tenantUserRoles = (userRoles || []).filter(
        (ur: { branch_id: string; role_id: string }) =>
          tenantBranchIds.includes(ur.branch_id) && studentRoleId && ur.role_id !== studentRoleId,
      );
      const uniqueUserIds = new Set(tenantUserRoles.map((ur: { user_id: string }) => ur.user_id));
      const totalUsers = uniqueUserIds.size;

      // Count students
      const tenantStudents = (students || []).filter(
        (s: { branch_id: string; is_active: boolean }) =>
          tenantBranchIds.includes(s.branch_id) && s.is_active,
      );
      const totalStudents = tenantStudents.length;

      // Get school admins
      const tenantAdminUserRoles = (adminUserRolesRows || []).filter((ur: { branch_id: string }) =>
        tenantBranchIds.includes(ur.branch_id),
      );
      const adminUserIds = new Set(tenantAdminUserRoles.map((ur: { user_id: string }) => ur.user_id));

      const schoolAdmins: TenantAdminInfo[] = Array.from(adminUserIds).map((userId: string) => ({
        userId,
        email: authUserMap.get(userId) || 'N/A',
        fullName: profileMap.get(userId) || null,
      }));

      // Count staff
      const tenantStaffRoles = (userRoles || []).filter(
        (ur: { branch_id: string; role_id: string }) =>
          tenantBranchIds.includes(ur.branch_id) && staffRoleIds.includes(ur.role_id),
      );
      const uniqueStaffIds = new Set(tenantStaffRoles.map((ur: { user_id: string }) => ur.user_id));
      const totalStaff = uniqueStaffIds.size;

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantCode: tenant.code,
        totalBranches: tenantBranchIds.length,
        totalUsers,
        totalStudents,
        schoolAdmins,
        domain: tenant.domain,
        email: tenant.email,
        phone: tenant.phone,
        totalStaff,
      };
    });

    return { data: statistics };
  }

  async setTenantActivation(
    tenantId: string,
    isActive: boolean,
    userEmail: string,
  ): Promise<{ data: TenantDto }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();

    const { data, error } = await supabase
      .from('tenants')
      .update({ is_active: isActive })
      .eq('id', tenantId)
      .select(TENANT_SELECT)
      .single();

    throwIfDbError(error);

    if (oldRow && data) {
      this.auditLogService
        .logUpdate(
          'tenants',
          tenantId,
          userEmail,
          oldRow as Record<string, unknown>,
          data as Record<string, unknown>,
          ['is_active'],
          { tenantId },
        )
        .catch(() => {});
    }

    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();
    throwIfDbError(themeError);

    const primaryColor =
      themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }

  async requestTenantDeletion(tenantId: string, userEmail: string): Promise<{ data: TenantDto }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: tenant, error: getError } = await supabase
      .from('tenants')
      .select('id, is_active')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(getError);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const now = new Date();
    const executeAt = new Date(now.getTime() + 2 * 60 * 1000);

    // Fields added by upcoming migration; safe as soon as migration is applied.
    const { data, error } = await supabase
      .from('tenants')
      .update({
        is_active: false,
        deletion_status: 'pending',
        deletion_requested_at: now.toISOString(),
        deletion_execute_at: executeAt.toISOString(),
        deletion_cancelled_at: null,
        deletion_requested_by: userEmail,
        pre_deletion_is_active: (tenant as { is_active: boolean }).is_active,
      })
      .eq('id', tenantId)
      .select(TENANT_SELECT)
      .single();

    throwIfDbError(error);

    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();
    throwIfDbError(themeError);

    const primaryColor =
      themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }

  async cancelTenantDeletion(tenantId: string, userEmail: string): Promise<{ data: TenantDto }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: tenant, error: getError } = await supabase
      .from('tenants')
      .select('id, deletion_status, pre_deletion_is_active')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(getError);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const row = tenant as { deletion_status: string | null; pre_deletion_is_active: boolean | null };
    if ((row.deletion_status || 'none') !== 'pending') {
      throw new BadRequestException('Tenant is not pending deletion');
    }

    const now = new Date();
    const { data, error } = await supabase
      .from('tenants')
      .update({
        deletion_status: 'none',
        deletion_cancelled_at: now.toISOString(),
        deletion_execute_at: null,
        deletion_requested_at: null,
        deletion_requested_by: null,
        is_active: row.pre_deletion_is_active ?? true,
        pre_deletion_is_active: null,
      })
      .eq('id', tenantId)
      .select(TENANT_SELECT)
      .single();

    throwIfDbError(error);

    this.auditLogService
      .logUpdate(
        'tenants',
        tenantId,
        userEmail,
        tenant as unknown as Record<string, unknown>,
        data as Record<string, unknown>,
        [
          'deletion_status',
          'deletion_cancelled_at',
          'deletion_execute_at',
          'deletion_requested_at',
          'deletion_requested_by',
          'is_active',
          'pre_deletion_is_active',
        ],
        { tenantId },
      )
      .catch(() => {});

    const themeSettingKey = this.getThemeSettingKey(tenantId);
    const { data: themeSetting, error: themeError } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('key', themeSettingKey)
      .maybeSingle();
    throwIfDbError(themeError);

    const primaryColor =
      themeSetting && typeof (themeSetting as SystemSettingRow).value === 'string'
        ? ((themeSetting as SystemSettingRow).value as string)
        : null;

    return { data: mapTenant(data as TenantRow, primaryColor) };
  }

  /**
   * Scheduled worker: execute pending tenant hard-deletes, then remove Supabase Auth users
   * who no longer belong to any branch (orphaned after tenant removal).
   */
  async runDueTenantDeletions(): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const nowIso = new Date().toISOString();

    const { data: dueTenants, error } = await supabase
      .from('tenants')
      .select('id, deletion_status, deletion_execute_at')
      .eq('deletion_status', 'pending')
      .lte('deletion_execute_at', nowIso)
      .limit(25);

    if (error) {
      this.logger.warn(`Failed to fetch due deletions: ${error.message}`);
      return;
    }

    const rows = (dueTenants || []) as Array<{
      id: string;
      deletion_status: string | null;
      deletion_execute_at: string | null;
    }>;

    await Promise.all(
      rows.map(async (t) => {
        try {
          const { data: locked, error: lockError } = await supabase
            .from('tenants')
            .update({ deletion_status: 'executing' })
            .eq('id', t.id)
            .eq('deletion_status', 'pending')
            .select('id')
            .maybeSingle();

          if (lockError) {
            this.logger.warn(`Failed to lock tenant ${t.id} for deletion: ${lockError.message}`);
            return;
          }
          if (!locked) return;

          const candidateUserIds = await this.collectUserIdsLinkedToTenant(supabase, t.id);

          const { error: rpcError } = await supabase.rpc('delete_tenant_cascade', {
            p_tenant_id: t.id,
          });

          if (rpcError) {
            this.logger.error(`Deletion RPC failed for tenant ${t.id}: ${rpcError.message}`);
            const { error: revertError } = await supabase
              .from('tenants')
              .update({ deletion_status: 'pending' })
              .eq('id', t.id)
              .eq('deletion_status', 'executing');
            if (revertError) {
              this.logger.warn(`Failed to revert tenant ${t.id} deletion_status: ${revertError.message}`);
            }
            return;
          }

          await this.deleteOrphanAuthUsersAfterTenantRemoval(supabase, candidateUserIds);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          this.logger.error(`Tenant deletion worker crashed for tenant ${t.id}: ${message}`);
        }
      }),
    );
  }

  private async collectUserIdsLinkedToTenant(supabase: SupabaseClient, tenantId: string): Promise<string[]> {
    const { data: branchRows, error: bErr } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId);
    if (bErr) {
      this.logger.warn(`collectUserIds: branches ${bErr.message}`);
      return [];
    }
    const branchIds = (branchRows || []).map((r: { id: string }) => r.id);
    if (branchIds.length === 0) return [];

    const [
      ubRes,
      urRes,
      stRes,
      sfRes,
      studIdsRes,
    ] = await Promise.all([
      supabase.from('user_branches').select('user_id').in('branch_id', branchIds).range(0, 10000),
      supabase.from('user_roles').select('user_id').in('branch_id', branchIds).range(0, 10000),
      supabase.from('students').select('user_id').in('branch_id', branchIds).not('user_id', 'is', null).range(0, 10000),
      supabase.from('staff').select('user_id').in('branch_id', branchIds).range(0, 10000),
      supabase.from('students').select('id').in('branch_id', branchIds).range(0, 10000),
    ]);

    const ids = new Set<string>();
    for (const row of (ubRes.data || []) as { user_id: string }[]) {
      if (row.user_id) ids.add(row.user_id);
    }
    for (const row of (urRes.data || []) as { user_id: string }[]) {
      if (row.user_id) ids.add(row.user_id);
    }
    for (const row of (stRes.data || []) as { user_id: string | null }[]) {
      if (row.user_id) ids.add(row.user_id);
    }
    for (const row of (sfRes.data || []) as { user_id: string }[]) {
      if (row.user_id) ids.add(row.user_id);
    }

    const studentIds = (studIdsRes.data || []).map((r: { id: string }) => r.id);
    if (studentIds.length > 0) {
      const { data: psRows } = await supabase
        .from('parent_students')
        .select('parent_user_id')
        .in('student_id', studentIds)
        .range(0, 10000);
      for (const row of (psRows || []) as { parent_user_id: string }[]) {
        if (row.parent_user_id) ids.add(row.parent_user_id);
      }
    }

    return Array.from(ids);
  }

  private async isAuthUserOrphaned(supabase: SupabaseClient, userId: string): Promise<boolean> {
    const [ub, ur, st, sf, ps] = await Promise.all([
      supabase.from('user_branches').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('staff').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('parent_students').select('student_id', { count: 'exact', head: true }).eq('parent_user_id', userId),
    ]);

    const n = (c: { count: number | null } | null) => c?.count ?? 0;
    return (
      n(ub) === 0 &&
      n(ur) === 0 &&
      n(st) === 0 &&
      n(sf) === 0 &&
      n(ps) === 0
    );
  }

  private async deleteOrphanAuthUsersAfterTenantRemoval(
    supabase: SupabaseClient,
    candidateUserIds: string[],
  ): Promise<void> {
    const unique = Array.from(new Set(candidateUserIds));
    const concurrency = 5;

    for (let i = 0; i < unique.length; i += concurrency) {
      const batch = unique.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (userId) => {
          try {
            const orphaned = await this.isAuthUserOrphaned(supabase, userId);
            if (!orphaned) return;

            const { error: invDel1 } = await supabase.from('invitations').delete().eq('created_by', userId);
            if (invDel1) {
              this.logger.warn(`Failed to delete invitations by created_by for ${userId}: ${invDel1.message}`);
            }
            const { error: invDel2 } = await supabase.from('invitations').delete().eq('user_id', userId);
            if (invDel2) {
              this.logger.warn(`Failed to delete invitations by user_id for ${userId}: ${invDel2.message}`);
            }

            const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
            if (delErr) {
              this.logger.warn(`auth.admin.deleteUser failed for ${userId}: ${delErr.message}`);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            this.logger.warn(`Orphan auth cleanup error for ${userId}: ${msg}`);
          }
        }),
      );
    }
  }
}








