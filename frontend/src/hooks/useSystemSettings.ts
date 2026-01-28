import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SystemSetting<TValue = unknown> {
  key: string;
  value: TValue;
  createdAt: string;
  updatedAt: string;
}

const settingsKeys = {
  byKey: (key: string) => ['systemSettings', 'key', key] as const,
  all: ['systemSettings', 'all'] as const,
};

export function useSystemSetting<TValue = unknown>(key: string) {
  return useQuery({
    queryKey: settingsKeys.byKey(key),
    queryFn: async () => apiClient.get<SystemSetting<TValue>>(`/api/v1/settings/${key}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSystemSetting<TValue = unknown>(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: TValue) => apiClient.put<SystemSetting<TValue>>(`/api/v1/settings/${key}`, { value }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: settingsKeys.byKey(key) });
      await qc.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}


