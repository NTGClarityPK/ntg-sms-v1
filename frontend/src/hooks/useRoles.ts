import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Role, Feature } from '@/types/permissions';
import { useAuth } from './useAuth';

export function useRoles() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['roles', branchId],
    queryFn: async () => {
      const response = await apiClient.get<Role[]>('/api/v1/roles');
      return response;
    },
    enabled: !!branchId,
  });
}

export function useFeatures() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['features', branchId],
    queryFn: async () => {
      const response = await apiClient.get<Feature[]>('/api/v1/features');
      return response;
    },
    enabled: !!branchId,
  });
}

