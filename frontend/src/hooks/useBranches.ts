import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { Branch } from '@/types/auth';

const branchesKeys = {
  all: ['branches'] as const,
  byTenant: () => [...branchesKeys.all, 'byTenant'] as const,
};

export function useTenantBranches() {
  return useQuery({
    queryKey: branchesKeys.byTenant(),
    queryFn: async () => {
      const res = await apiClient.get<Branch[]>('/api/v1/branches/by-tenant');
      return res;
    },
  });
}


