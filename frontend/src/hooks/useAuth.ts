'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { User } from '@/types/auth';

async function fetchCurrentUser(): Promise<User> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const fullUrl = `${apiUrl}/api/v1/auth/me`;
    console.log('useAuth - Fetching user from:', fullUrl);
    console.log('useAuth - Base URL:', apiUrl);
    const response = await apiClient.get<User>('/api/v1/auth/me');
    console.log('useAuth - API Response:', response);
    console.log('useAuth - Response.data:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('useAuth - Error fetching user:', error);
    console.error('useAuth - Error details:', {
      message: error.message,
      code: error.code,
      config: error.config,
      request: error.request,
    });
    throw error;
  }
}

export function useAuth() {
  console.log('useAuth - Hook initializing');
  
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

  console.log('useAuth - Hook state - user:', user, 'isLoading:', isLoading, 'isFetching:', isFetching, 'status:', status, 'error:', error);

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    refetch,
  };
}

