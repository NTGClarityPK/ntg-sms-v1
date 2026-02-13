import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { Branch } from '@/types/auth';

const branchesKeys = {
  all: ['branches'] as const,
  byTenant: () => [...branchesKeys.all, 'byTenant'] as const,
  byId: (id: string) => [...branchesKeys.all, 'byId', id] as const,
};

export interface BranchDetails {
  id: string;
  tenantId?: string | null;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  storageQuotaGb: number;
  storageUsedBytes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBranchPayload {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function useTenantBranches() {
  return useQuery({
    queryKey: branchesKeys.byTenant(),
    queryFn: async () => {
      const res = await apiClient.get<Branch[]>('/api/v1/branches/by-tenant');
      return res;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - branches rarely change
  });
}

export function useBranchById(id: string | null | undefined) {
  return useQuery({
    queryKey: branchesKeys.byId(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Branch ID is required');
      const res = await apiClient.get<{ data: BranchDetails }>(`/api/v1/branches/${id}`);
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
      await qc.invalidateQueries({ queryKey: branchesKeys.byId(variables.id) });
      await qc.invalidateQueries({ queryKey: branchesKeys.byTenant() });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export interface AssignBranchToTenantPayload {
  tenantId: string;
  name: string;
  nameAr?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  storageQuotaGb?: number;
  isActive?: boolean;
}

export function useAssignBranchToTenant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AssignBranchToTenantPayload) => {
      const res = await apiClient.post<BranchDetails>('/api/v1/branches/assign-to-tenant', payload);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: branchesKeys.all });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}


