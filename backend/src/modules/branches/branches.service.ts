import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchDto } from './dto/branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { resolveContentLanguage, SYSTEM_DEFAULT_LOCALE } from '../../common/utils/locale.util';

/** Caller context for membership-scoped branch endpoints. */
export type BranchAccessContext = {
  userId: string;
  email: string;
  roles?: string[];
};

type BranchAccessAttempt = 'get' | 'update' | 'public-stats';

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
  const normalized = resolveContentLanguage(language);
  const englishKey = normalized === 'ar' ? null : 'en';
  return (
    (t?.[normalized] ?? (englishKey ? t?.[englishKey] : undefined) ?? t?.en ?? row.name) || row.name
  );
}

function mapBranch(row: BranchRow, language: string = SYSTEM_DEFAULT_LOCALE): BranchDto {
  const resolvedLanguage = resolveContentLanguage(language);
  const name = resolveBranchName(row, resolvedLanguage);
  const translations = row.name_translations ?? null;
  return new BranchDto({
    id: row.id,
    tenantId: row.tenant_id,
    name,
    nameAr: row.name_ar ?? translations?.ar ?? null,
    nameTranslations: translations
      ? {
          en: translations.en ?? row.name,
          ar: translations.ar ?? row.name_ar ?? '',
        }
      : {
          en: row.name,
          ar: row.name_ar ?? '',
        },
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
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private isTenantOwner(roles?: string[]): boolean {
    return (roles ?? []).includes('tenant_owner');
  }

  private emptyListMeta(
    page: number,
    limit: number,
  ): { data: BranchDto[]; meta: { total: number; page: number; limit: number; totalPages: number } } {
    return {
      data: [],
      meta: { total: 0, page, limit, totalPages: 1 },
    };
  }

  private async getAccessibleBranchIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', userId);
    throwIfDbError(error);
    return (data ?? []).map((row: { branch_id: string }) => row.branch_id);
  }

  private async getTenantIdsForUser(userId: string): Promise<string[]> {
    const branchIds = await this.getAccessibleBranchIds(userId);
    if (branchIds.length === 0) {
      return [];
    }
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .select('tenant_id')
      .in('id', branchIds);
    throwIfDbError(error);
    const tenantIds = new Set<string>();
    for (const row of data ?? []) {
      const tenantId = (row as { tenant_id: string | null }).tenant_id;
      if (tenantId) {
        tenantIds.add(tenantId);
      }
    }
    return [...tenantIds];
  }

  private async assertBranchAccess(params: {
    userId: string;
    email: string;
    roles?: string[];
    branchId: string;
    attempted: BranchAccessAttempt;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', params.userId)
      .eq('branch_id', params.branchId)
      .maybeSingle();
    throwIfDbError(error);

    if (data) {
      return;
    }

    throw new ForbiddenException('Access denied');
  }

  async list(
    query: QueryBranchesDto,
    access: Pick<BranchAccessContext, 'userId' | 'roles'>,
  ): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const language = query.language ?? 'en-GB';

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

    if (this.isTenantOwner(access.roles)) {
      const tenantIds = await this.getTenantIdsForUser(access.userId);
      if (tenantIds.length === 0) {
        return this.emptyListMeta(page, limit);
      }
      dbQuery = dbQuery.in('tenant_id', tenantIds);
    } else {
      const branchIds = await this.getAccessibleBranchIds(access.userId);
      if (branchIds.length === 0) {
        return this.emptyListMeta(page, limit);
      }
      dbQuery = dbQuery.in('id', branchIds);
    }

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
      data: ((data as BranchRow[]) ?? []).map((row) => mapBranch(row, language)),
      meta: { total, page, limit, totalPages },
    };
  }

  async getById(
    id: string,
    language: string = 'en-GB',
    access?: BranchAccessContext,
  ): Promise<BranchDto> {
    if (access) {
      await this.assertBranchAccess({
        userId: access.userId,
        email: access.email,
        roles: access.roles,
        branchId: id,
        attempted: 'get',
      });
    }

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
    access?: BranchAccessContext,
  ): Promise<void> {
    if (access) {
      await this.assertBranchAccess({
        userId: access.userId,
        email: access.email,
        roles: access.roles,
        branchId,
        attempted: 'public-stats',
      });
    }

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

      if (requestedCode !== '' && error?.code === '23505') {
        throw new BadRequestException(
          `Branch code "${requestedCode}" already exists. Please choose a different code.`,
        );
      }

      if (requestedCode === '' && error?.code === '23505') {
        continue;
      }

      break;
    }

    throwIfDbError(lastError);
    if (!row) {
      throw new BadRequestException('Failed to create branch');
    }
    return mapBranch(row, 'en-GB');
  }

  async update(
    id: string,
    input: UpdateBranchDto,
    _userEmail: string,
    access?: BranchAccessContext,
  ): Promise<BranchDto> {
    if (access) {
      await this.assertBranchAccess({
        userId: access.userId,
        email: access.email,
        roles: access.roles,
        branchId: id,
        attempted: 'update',
      });
    }

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
    return mapBranch(data as BranchRow, 'en-GB');
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

  async listByTenant(
    tenantId: string | null,
    userId: string,
    language: string = SYSTEM_DEFAULT_LOCALE,
  ): Promise<{ data: BranchDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const resolvedLanguage = resolveContentLanguage(language);

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
      data: ((branches as BranchRow[]) ?? []).map((row) => mapBranch(row, resolvedLanguage)),
    };
  }
}
