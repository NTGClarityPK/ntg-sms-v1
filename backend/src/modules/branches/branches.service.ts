import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { BranchDto } from './dto/branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AssignBranchToTenantDto } from './dto/assign-branch-to-tenant.dto';
import { SubscriptionService } from '../subscription/subscription.service';

type BranchRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  name_ar: string | null;
  name_translations?: Record<string, string> | null;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  storage_quota_gb: number;
  storage_used_bytes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  public_stats_enabled?: boolean;
  public_stats_password?: string | null;
};

function generateBranchCodeFromName(name: string): string {
  const cleaned = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${cleaned || 'BRANCH'}${random}`;
}

function resolveBranchName(
  row: { name: string; name_translations?: Record<string, string> | null },
  language: string,
): string {
  const t = row.name_translations;
  return (t?.[language] ?? t?.en ?? row.name) || row.name;
}

function mapBranch(row: BranchRow, language: string = 'ar'): BranchDto {
  const name = resolveBranchName(row, language);
  return new BranchDto({
    id: row.id,
    tenantId: row.tenant_id,
    name,
    nameAr: row.name_ar,
    code: row.code,
    address: row.address,
    phone: row.phone,
    email: row.email,
    storageQuotaGb: row.storage_quota_gb,
    storageUsedBytes: row.storage_used_bytes,
    isActive: row.is_active,
    publicStatsEnabled: row.public_stats_enabled ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async list(query: QueryBranchesDto): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const language = query.language ?? 'ar';

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('branches')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${query.search}%,code.ilike.%${query.search}%`,
      );
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: (data as BranchRow[]).map((row) => mapBranch(row, language)),
      meta: { total, page, limit, totalPages },
    };
  }

  async getById(id: string, language: string = 'ar'): Promise<BranchDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Branch not found');
    }
    return mapBranch(data as BranchRow, language);
  }

  async getByCode(code: string): Promise<{
    id: string;
    code: string | null;
    public_stats_enabled: boolean;
    public_stats_password: string | null;
  } | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('id, code, public_stats_enabled, public_stats_password')
      .eq('code', code)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) return null;
    const row = data as {
      id: string;
      code: string | null;
      public_stats_enabled: boolean | null;
      public_stats_password: string | null;
    };
    return {
      id: row.id,
      code: row.code,
      public_stats_enabled: row.public_stats_enabled ?? false,
      public_stats_password: row.public_stats_password ?? null,
    };
  }

  async updatePublicStats(
    branchId: string,
    enabled: boolean,
    password: string | null | undefined,
    userEmail: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const payload: Record<string, unknown> = {
      public_stats_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: userEmail,
    };
    if (password !== undefined) {
      payload.public_stats_password = password;
    }
    const { error } = await supabase.from('branches').update(payload).eq('id', branchId);
    throwIfDbError(error);
  }

  async create(input: CreateBranchDto, userEmail: string): Promise<BranchDto> {
    const supabase = this.supabaseConfig.getClient();
    const nameTranslations = input.name_translations ?? { en: input.name, ar: input.nameAr ?? input.name };
    const requestedCode = (input.code ?? '').trim();

    let lastError: PostgrestError | null = null;
    let row: BranchRow | null = null;

    for (let attempt = 0; attempt < 7; attempt++) {
      const generated = generateBranchCodeFromName(input.name);
      const codeToUse = requestedCode !== '' ? requestedCode : generated;

      const { data, error } = await supabase
        .from('branches')
        .insert({
          name: input.name,
          name_ar: input.nameAr ?? null,
          name_translations: nameTranslations,
          code: codeToUse,
          address: input.address ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          storage_quota_gb: input.storageQuotaGb ?? 100,
          is_active: input.isActive ?? true,
        })
        .select('*')
        .single();

      if (!error && data) {
        row = data as BranchRow;
        break;
      }

      lastError = error;

      // If user provided a code and it's not unique, fail fast with a useful message.
      if (requestedCode !== '' && error?.code === '23505') {
        throw new BadRequestException(
          `Branch code "${requestedCode}" already exists. Please choose a different code.`,
        );
      }

      // Auto-generated codes: retry on unique violation.
      if (requestedCode === '' && error?.code === '23505') {
        continue;
      }

      break;
    }

    throwIfDbError(lastError);
    if (!row) {
      throw new BadRequestException('Failed to create branch');
    }
    this.auditLogService
      .logCreate('branches', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId: row.id,
        tenantId: row.tenant_id,
      })
      .catch(() => {});
    return mapBranch(row, 'ar');
  }

  async update(
    id: string,
    input: UpdateBranchDto,
    userEmail: string,
  ): Promise<BranchDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!existing) {
      throw new NotFoundException('Branch not found');
    }

    const updates: Record<string, unknown> = {
      code: input.code ?? undefined,
      address: input.address ?? undefined,
      phone: input.phone ?? undefined,
      email: input.email ?? undefined,
      storage_quota_gb: input.storageQuotaGb ?? undefined,
      is_active: input.isActive ?? undefined,
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.nameAr !== undefined) updates.name_ar = input.nameAr;
    if (input.name_translations !== undefined) updates.name_translations = input.name_translations;

    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);
    const newRow = data as BranchRow;
    const changedFields = Object.keys(input).filter(
      (k) => (existing as Record<string, unknown>)[k] !== (newRow as Record<string, unknown>)[k],
    ) as string[];
    this.auditLogService
      .logUpdate(
        'branches',
        id,
        userEmail,
        existing as Record<string, unknown>,
        newRow as Record<string, unknown>,
        changedFields.length ? changedFields : [],
        { branchId: id, tenantId: (existing as BranchRow).tenant_id },
      )
      .catch(() => {});
    return mapBranch(newRow, 'ar');
  }

  async getStorage(id: string): Promise<{
    quotaGb: number;
    usedBytes: number;
    usedPercentage: number;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('storage_quota_gb, storage_used_bytes')
      .eq('id', id)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Branch not found');
    }

    const row = data as Pick<
      BranchRow,
      'storage_quota_gb' | 'storage_used_bytes'
    >;

    const quotaBytes = row.storage_quota_gb * 1024 * 1024 * 1024;
    const usedBytes = row.storage_used_bytes;
    const usedPercentage =
      quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;

    return {
      quotaGb: row.storage_quota_gb,
      usedBytes,
      usedPercentage,
    };
  }

  async listByTenant(tenantId: string | null, userId: string): Promise<{ data: BranchDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Get all branches for the tenant that the user has access to
    const { data: userBranches, error: userBranchesError } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);

    throwIfDbError(userBranchesError);

    if (!userBranches || userBranches.length === 0) {
      return { data: [] };
    }

    const branchIds = userBranches.map((ub) => ub.branch_id);

    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('id', branchIds)
      .order('name', { ascending: true });

    throwIfDbError(branchesError);

    return {
      data: ((branches as BranchRow[]) ?? []).map((row) => mapBranch(row, 'ar')),
    };
  }

  async listByTenantAdmin(tenantId: string): Promise<{ data: BranchDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Admin method: get all branches for the tenant without user access filtering
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    throwIfDbError(branchesError);

    return {
      data: ((branches as BranchRow[]) ?? []).map((row) => mapBranch(row, 'ar')),
    };
  }

  async assignBranchToTenant(input: AssignBranchToTenantDto, userEmail: string): Promise<BranchDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', input.tenantId)
      .maybeSingle();

    throwIfDbError(tenantError);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const usagePayload = await this.subscriptionService.getUsageWithLimits(input.tenantId, true);
    const proposedBranches = usagePayload.usage.branchesUsed + 1;
    await this.subscriptionService.assertWithinLimit(input.tenantId, 'branches', proposedBranches);
    if (proposedBranches > 1) {
      await this.subscriptionService.assertFeature(input.tenantId, 'hasMultiBranch');
    }

    const requestedCode = (input.code ?? '').trim();

    let lastError: PostgrestError | null = null;
    let branchRow: BranchRow | null = null;

    for (let attempt = 0; attempt < 7; attempt++) {
      const generated = generateBranchCodeFromName(input.name);
      const codeToUse = requestedCode !== '' ? requestedCode : generated;

      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert({
          tenant_id: input.tenantId,
          name: input.name,
          name_ar: input.nameAr ?? null,
          name_translations: { en: input.name, ar: input.nameAr ?? input.name },
          code: codeToUse,
          address: input.address ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          storage_quota_gb: input.storageQuotaGb ?? 100,
          is_active: input.isActive ?? true,
        })
        .select('*')
        .single();

      if (!branchError && branch) {
        branchRow = branch as BranchRow;
        break;
      }

      lastError = branchError;

      if (requestedCode !== '' && branchError?.code === '23505') {
        throw new BadRequestException(
          `Branch code "${requestedCode}" already exists. Please choose a different code.`,
        );
      }

      if (requestedCode === '' && branchError?.code === '23505') {
        continue;
      }

      break;
    }

    throwIfDbError(lastError);
    if (!branchRow) {
      throw new BadRequestException('Failed to create branch');
    }

    const newBranch = mapBranch(branchRow);
    this.auditLogService
      .logCreate(
        'branches',
        newBranch.id,
        userEmail,
        { ...branchRow } as Record<string, unknown>,
        { branchId: newBranch.id, tenantId: input.tenantId },
      )
      .catch(() => {});
    void this.subscriptionService.syncUsage(input.tenantId).catch(() => {});

    // Find all school_admin users for this tenant (from existing branches)
    const { data: existingBranches, error: branchesError } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .neq('id', newBranch.id);

    throwIfDbError(branchesError);
    const existingBranchIds = (existingBranches || []).map((b: { id: string }) => b.id);

    if (existingBranchIds.length > 0) {
      // Get school_admin role ID
      const { data: adminRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'school_admin')
        .maybeSingle();

      throwIfDbError(roleError);
      if (adminRole) {
        // Find users who have school_admin role in any of the tenant's existing branches
        const { data: userRoles, error: userRolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role_id', adminRole.id)
          .in('branch_id', existingBranchIds);

        throwIfDbError(userRolesError);
        const adminUserIds = [
          ...new Set((userRoles || []).map((ur: { user_id: string }) => ur.user_id)),
        ];

        if (adminUserIds.length > 0) {
          // Assign these users to the new branch
          const userBranchInserts = adminUserIds.map((userId: string) => ({
            user_id: userId,
            branch_id: newBranch.id,
            is_primary: false, // Don't set as primary automatically
          }));

          const { error: userBranchError } = await supabase
            .from('user_branches')
            .insert(userBranchInserts);

          throwIfDbError(userBranchError);

          // Assign school_admin role to these users for the new branch
          const userRoleInserts = adminUserIds.map((userId: string) => ({
            user_id: userId,
            role_id: adminRole.id,
            branch_id: newBranch.id,
          }));

          const { error: userRoleError } = await supabase
            .from('user_roles')
            .insert(userRoleInserts);

          throwIfDbError(userRoleError);
        }
      }
    }

    return newBranch;
  }
}




