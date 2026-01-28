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
    isFetching,
    status,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: true,
    staleTime: 0,
    gcTime: 0,
  });

  // Store branch ID in localStorage when user data changes
  if (user?.currentBranch?.id && typeof window !== 'undefined') {
    localStorage.setItem('currentBranchId', user.currentBranch.id);
  }

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    refetch,
  };
}

