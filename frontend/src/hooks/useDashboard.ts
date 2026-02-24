'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DashboardData, DashboardWidget, DashboardPreferences } from '@/types/dashboard';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

/** GET /api/v1/dashboard – no meta → return response.data */
export function useDashboard() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['dashboard', 'data', branchId],
    queryFn: async () => {
      const response = await apiClient.get<DashboardData>('/api/v1/dashboard');
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/** GET /api/v1/dashboard/widgets – no meta → return response.data */
export function useDashboardWidgets(role?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['dashboard', 'widgets', branchId, role ?? 'all'],
    queryFn: async () => {
      const params = role ? { role } : {};
      const response = await apiClient.get<DashboardWidget[]>(
        '/api/v1/dashboard/widgets',
        { params },
      );
      return response.data ?? [];
    },
    enabled: !!branchId && role !== undefined,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/** GET /api/v1/dashboard/preferences – no meta → return response.data */
export function useDashboardPreferencesQuery() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['dashboard', 'preferences', branchId],
    queryFn: async () => {
      const response = await apiClient.get<DashboardPreferences>(
        '/api/v1/dashboard/preferences',
      );
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

/** PUT /api/v1/dashboard/preferences */
export function useDashboardPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (preferences: DashboardPreferences) => {
      const response = await apiClient.put<DashboardPreferences>(
        '/api/v1/dashboard/preferences',
        preferences,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ title: 'Preferences saved', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to save preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: errorColor,
      });
    },
  });
}
