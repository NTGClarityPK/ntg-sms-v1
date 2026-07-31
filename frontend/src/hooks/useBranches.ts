import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import type { Branch } from '@/types/auth';

const branchesKeys = {
  all: ['branches'] as const,
  byTenant: (locale?: string) => [...branchesKeys.all, 'byTenant', locale ?? ''] as const,
  byId: (id: string, locale?: string) => [...branchesKeys.all, 'byId', id, locale ?? ''] as const,
};

export interface BranchDetails {
  id: string;
  tenantId?: string | null;
  name: string;
  nameAr?: string | null;
  nameTranslations?: { en?: string; ar?: string } | null;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  storageQuotaGb: number;
  storageUsedBytes: number;
  isActive: boolean;
  publicStatsEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBranchPayload {
  name?: string;
  name_translations?: { en?: string; ar?: string };
  address?: string;
  phone?: string;
  email?: string;
}

export function useTenantBranches() {
  const locale = useLocale();
  return useQuery({
    queryKey: branchesKeys.byTenant(locale),
    queryFn: async () => {
      const res = await apiClient.get<Branch[]>('/api/v1/branches/by-tenant', {
        params: { language: locale },
      });
      return res;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - branches rarely change
  });
}

export function useBranchById(id: string | null | undefined) {
  const locale = useLocale();
  return useQuery({
    queryKey: branchesKeys.byId(id || '', locale),
    queryFn: async () => {
      if (!id) throw new Error('Branch ID is required');
      const res = await apiClient.get<BranchDetails>(`/api/v1/branches/${id}`, {
        params: { language: locale },
      });
      return res;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateBranchPayload }) => {
      const res = await apiClient.put<BranchDetails>(`/api/v1/branches/${id}`, payload);
      return res;
    },
    onSuccess: async (_, variables) => {
      await qc.invalidateQueries({ queryKey: ['branches', 'byId', variables.id] });
      await qc.invalidateQueries({ queryKey: branchesKeys.byTenant() });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export interface UpdatePublicStatsPayload {
  enabled: boolean;
  password?: string | null;
}

export function useUpdatePublicStats() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      branchId,
      payload,
    }: {
      branchId: string;
      payload: UpdatePublicStatsPayload;
    }) => {
      const res = await apiClient.put<{ success: boolean }>(
        `/api/v1/branches/${branchId}/public-stats`,
        payload,
      );
      return res;
    },
    onSuccess: async (_, variables) => {
      await qc.invalidateQueries({ queryKey: branchesKeys.byId(variables.branchId) });
    },
  });
}


