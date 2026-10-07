import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class AdminLogsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async recordHit(input: {
    tenantId?: string | null;
    method: string;
    url: string;
    statusCode: number;
    responseTimeMs?: number;
    actionType?: string;
    requestBody?: unknown;
    responseBody?: unknown;
  }): Promise<void> {
    try {
      const supabase = this.supabaseConfig.getClient();
      await supabase.from('api_hits').insert({
        tenant_id: input.tenantId ?? null,
        method: input.method.slice(0, 16),
        url: input.url.slice(0, 2000),
        status_code: input.statusCode,
        response_time_ms: input.responseTimeMs ?? null,
        action_type: input.actionType ?? null,
        request_body: input.requestBody ?? null,
        response_body: input.responseBody ?? null,
      });
    } catch {
      // Never fail the request because of logging
    }
  }

  async listHits(query: {
    tenantId?: string;
    method?: string;
    statusCode?: number;
    actionType?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ data: Record<string, unknown>[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const supabase = this.supabaseConfig.getClient();

    let q = supabase
      .from('api_hits')
      .select(
        'id, tenant_id, method, url, status_code, response_time_ms, action_type, request_body, response_body, created_at',
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (query.tenantId) q = q.eq('tenant_id', query.tenantId);
    if (query.method) q = q.eq('method', query.method.toUpperCase());
    if (query.statusCode != null) q = q.eq('status_code', query.statusCode);
    if (query.actionType) q = q.eq('action_type', query.actionType);
    if (query.cursor) {
      const [createdAt, id] = query.cursor.split('|');
      if (createdAt && id) {
        q = q.or(
          `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
        );
      }
    }

    const { data, error } = await q;
    throwIfDbError(error);

    const rows = (data ?? []) as Array<{
      id: string;
      tenant_id: string | null;
      method: string;
      url: string;
      status_code: number;
      response_time_ms: number | null;
      action_type: string | null;
      request_body: unknown;
      response_body: unknown;
      created_at: string;
    }>;

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? `${last.created_at}|${last.id}` : null;

    return {
      data: page.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        method: r.method,
        url: r.url,
        statusCode: r.status_code,
        responseTimeMs: r.response_time_ms,
        actionType: r.action_type,
        requestBody: r.request_body,
        responseBody: r.response_body,
        createdAt: r.created_at,
      })),
      nextCursor,
    };
  }
}
