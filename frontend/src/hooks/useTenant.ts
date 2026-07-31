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
    retry: (failureCount, error) => {
      const isNetwork = (error as { code?: string })?.code === 'ERR_NETWORK' || (error as Error)?.message === 'Network Error';
      return isNetwork && failureCount < 2;
    },
    retryDelay: 800,
    staleTime: 5 * 60 * 1000,  // 5 minutes - tenant data rarely changes
  });
}

export function useUpdateTenantMe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name?: string;
      domain?: string;
      email?: string;
      phone?: string;
      timezone?: string;
      fiscalYearStart?: string;
      vatNumber?: string;
      defaultLocale?: 'en-GB' | 'en-US' | 'ar';
      primaryColor?: string;
    }) => {
      const res = await apiClient.patch<Tenant>('/api/v1/tenants/me', payload);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: tenantKeys.me() });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useUploadTenantLogo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<Tenant>('/api/v1/tenants/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: tenantKeys.me() });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}



