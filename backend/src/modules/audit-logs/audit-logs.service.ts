import { Injectable, ForbiddenException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';

type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  user_email: string;
  username: string;
  branch_id: string | null;
  tenant_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditLogDto = {
  id: string;
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userEmail: string;
  username: string;
  branchId: string | null;
  tenantId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedFields: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

function mapAuditLog(row: AuditLogRow): AuditLogDto {
  return {
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    userEmail: row.user_email,
    username: row.username,
    branchId: row.branch_id,
    tenantId: row.tenant_id,
    oldValues: row.old_values,
    newValues: row.new_values,
    changedFields: row.changed_fields,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new Error(error.message);
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    tableName?: string;
    action?: 'CREATE' | 'UPDATE' | 'DELETE';
    username?: string;
    branchId?: string;
    tenantId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: AuditLogDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100); // Max 100 per page
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.tableName) {
      dbQuery = dbQuery.eq('table_name', query.tableName);
    }
    if (query.action) {
      dbQuery = dbQuery.eq('action', query.action);
    }
    if (query.username) {
      dbQuery = dbQuery.ilike('username', `%${query.username}%`);
    }
    if (query.branchId) {
      dbQuery = dbQuery.eq('branch_id', query.branchId);
    }
    if (query.tenantId) {
      dbQuery = dbQuery.eq('tenant_id', query.tenantId);
    }
    if (query.startDate) {
      dbQuery = dbQuery.gte('created_at', query.startDate);
    }
    if (query.endDate) {
      dbQuery = dbQuery.lte('created_at', query.endDate);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: (data as AuditLogRow[]).map(mapAuditLog),
      meta: { total, page, limit, totalPages },
    };
  }

  async getAuditLogById(id: string): Promise<AuditLogDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', id)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new Error('Audit log not found');
    }

    return mapAuditLog(data as AuditLogRow);
  }

  async getAuditLogsForRecord(
    tableName: string,
    recordId: string,
  ): Promise<AuditLogDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false });

    throwIfDbError(error);

    return (data as AuditLogRow[]).map(mapAuditLog);
  }
}
