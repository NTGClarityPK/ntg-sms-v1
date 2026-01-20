'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { User } from '@/types/auth';

async function fetchCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>('/api/v1/auth/me');
  return response.data;
}

export function useAuth() {
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    refetch,
  };
}

