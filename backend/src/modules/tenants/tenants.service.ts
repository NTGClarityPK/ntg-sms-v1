import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
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
  });
}

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class TenantsService {
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
      .select('id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, is_active, logo_url')
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
        .select('id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, is_active, logo_url')
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
        .select('id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, is_active, logo_url')
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
      .select('id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, is_active, logo_url')
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
      .select('id, name, code, domain, email, phone, timezone, fiscal_year_start, vat_number, is_active, logo_url')
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
      .select('id, name, code, domain, email, phone')
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
      .select('id, tenant_id')
      .in('tenant_id', tenantIds);

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

    // Get all users with roles in branches (for user count)
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role_id, branch_id')
      .in('branch_id', branchIds);

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
      const adminUserRoles = (userRoles || []).filter(
        (ur: { branch_id: string; role_id: string }) =>
          tenantBranchIds.includes(ur.branch_id) && adminRoleId && ur.role_id === adminRoleId,
      );
      adminUserRoles.forEach((ur: { user_id: string }) => allAdminUserIds.add(ur.user_id));
    });

    // Fetch profiles and emails only for admin users
    const adminUserIdsArray = Array.from(allAdminUserIds);
    const [profilesResult, ...authUserResults] = await Promise.all([
      adminUserIdsArray.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', adminUserIdsArray)
        : Promise.resolve({ data: [], error: null }),
      ...adminUserIdsArray.map((userId) =>
        supabase.auth.admin.getUserById(userId).then((res) => ({
          userId,
          email: res.data.user?.email || null,
          error: res.error,
        })),
      ),
    ]);

    throwIfDbError(profilesResult.error);

    const profileMap = new Map<string, string | null>();
    ((profilesResult.data || []) as { id: string; full_name: string | null }[]).forEach((p) => {
      profileMap.set(p.id, p.full_name);
    });

    const authUserMap = new Map<string, string>();
    authUserResults.forEach((result) => {
      if (result.email) {
        authUserMap.set(result.userId, result.email);
      }
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
      const adminUserRoles = (userRoles || []).filter(
        (ur: { branch_id: string; role_id: string }) =>
          tenantBranchIds.includes(ur.branch_id) && adminRoleId && ur.role_id === adminRoleId,
      );
      const adminUserIds = new Set(adminUserRoles.map((ur: { user_id: string }) => ur.user_id));

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
}








