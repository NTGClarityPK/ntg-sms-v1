import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type AuditLog = {
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

export type QueryAuditLogsParams = {
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
};

type AuditLogsResponse = {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export function useAuditLogs(params: QueryAuditLogsParams = {}) {
  return useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.tableName) searchParams.set('tableName', params.tableName);
      if (params.action) searchParams.set('action', params.action);
      if (params.username) searchParams.set('username', params.username);
      if (params.branchId) searchParams.set('branchId', params.branchId);
      if (params.tenantId) searchParams.set('tenantId', params.tenantId);
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      // Backend returns { data: AuditLogDto[], meta: {...} }
      // ResponseInterceptor passes it through as-is
      const response = await apiClient.get<AuditLog[]>(
        `/api/v1/audit-logs?${searchParams.toString()}`,
      );
      // Ensure query data is typed as { data, meta } for consistent access in components
      return response as unknown as AuditLogsResponse;
    },
    staleTime: 30 * 1000, // 30 seconds - audit logs should be relatively fresh
  });
}
