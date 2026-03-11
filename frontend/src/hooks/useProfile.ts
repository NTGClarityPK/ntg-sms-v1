import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { UserProfile, UpdateProfileInput } from '@/types/profile';

const profileKeys = {
  root: ['profile'] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.root,
    queryFn: async () => {
      const response = await apiClient.get<UserProfile>('/api/v1/auth/profile');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProfileInput) => {
      const response = await apiClient.put<UserProfile>('/api/v1/auth/profile', payload);
      return response.data;
    },
    onSuccess: async (data) => {
      await qc.setQueryData(profileKeys.root, data);
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

