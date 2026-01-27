'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import type { Branch } from '@/types/auth';

export function useBranchSwitcher() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { refetch: refetchAuth } = useAuth();

  const { mutate: switchBranch, isPending: isSwitching } = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await apiClient.post<{ data: Branch }>('/api/v1/auth/select-branch', {
        branchId,
      });
      return response.data?.data;
    },
    onSuccess: (data) => {
      // Update localStorage with new branch ID
      if (typeof window !== 'undefined' && data?.id) {
        localStorage.setItem('currentBranchId', data.id);
      }

      // Refetch user data to get updated currentBranch
      refetchAuth();

      // Invalidate all queries to refresh data for new branch
      queryClient.invalidateQueries();

      notifications.show({
        title: 'Success',
        message: `Switched to ${data?.name || data?.code || 'branch'}`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to switch branch',
        color: 'red',
      });
    },
  });

  return {
    switchBranch,
    isSwitching,
  };
}

