import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Tenant } from '@/types/tenant';

const tenantKeys = {
  all: ['tenant'] as const,
  me: () => [...tenantKeys.all, 'me'] as const,
};

export function useTenantMe() {
  return useQuery({
    queryKey: tenantKeys.me(),
    queryFn: async () => {
      const res = await apiClient.get<Tenant>('/api/v1/tenants/me');
      return res;
    },
  });
}

export function useUpdateTenantMe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string }) => {
      const res = await apiClient.patch<Tenant>('/api/v1/tenants/me', payload);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: tenantKeys.me() });
    },
  });
}


