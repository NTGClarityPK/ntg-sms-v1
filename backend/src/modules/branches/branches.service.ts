import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchDto } from './dto/branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

type BranchRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  name_ar: string | null;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  storage_quota_gb: number;
  storage_used_bytes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapBranch(row: BranchRow): BranchDto {
  return new BranchDto({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    nameAr: row.name_ar,
    code: row.code,
    address: row.address,
    phone: row.phone,
    email: row.email,
    storageQuotaGb: row.storage_quota_gb,
    storageUsedBytes: row.storage_used_bytes,
    isActive: row.is_active,
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
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async list(query: QueryBranchesDto): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

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
      data: (data as BranchRow[]).map(mapBranch),
      meta: { total, page, limit, totalPages },
    };
  }

  async getById(id: string): Promise<BranchDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Branch not found');
    }
    return mapBranch(data as BranchRow);
  }

  async create(input: CreateBranchDto): Promise<BranchDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('branches')
      .insert({
        name: input.name,
        name_ar: input.nameAr ?? null,
        code: input.code ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        storage_quota_gb: input.storageQuotaGb ?? 100,
        is_active: input.isActive ?? true,
      })
      .select('*')
      .single();

    throwIfDbError(error);
    return mapBranch(data as BranchRow);
  }

  async update(id: string, input: UpdateBranchDto): Promise<BranchDto> {
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

    const { data, error } = await supabase
      .from('branches')
      .update({
        name: input.name ?? undefined,
        name_ar: input.nameAr ?? undefined,
        code: input.code ?? undefined,
        address: input.address ?? undefined,
        phone: input.phone ?? undefined,
        email: input.email ?? undefined,
        storage_quota_gb: input.storageQuotaGb ?? undefined,
        is_active: input.isActive ?? undefined,
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);
    return mapBranch(data as BranchRow);
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
      data: ((branches as BranchRow[]) ?? []).map(mapBranch),
    };
  }
}




