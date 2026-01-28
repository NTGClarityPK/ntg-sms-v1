import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@/types/notifications';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface QueryNotificationsParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

export function useNotifications(params?: QueryNotificationsParams) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['notifications', userId, params],
    queryFn: async () => {
      if (!userId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.isRead !== undefined)
        queryParams.append('isRead', params.isRead.toString());
      if (params?.type) queryParams.append('type', params.type);

      const response = await apiClient.get<Notification[]>(
        `/api/v1/notifications?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!userId,
  });
}

export function useNotification(id: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['notification', id, userId],
    queryFn: async () => {
      if (!id || !userId) return null;
      const response = await apiClient.get<{ data: Notification }>(
        `/api/v1/notifications/${id}`,
      );
      return response.data;
    },
    enabled: !!id && !!userId,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: async () => {
      if (!userId) return 0;

      // Fetch total notifications (any status), but limit data payload
      const allResponse = await apiClient.get<Notification[]>(
        `/api/v1/notifications?limit=1`,
      );
      const totalCount = allResponse.meta?.total ?? allResponse.data?.length ?? 0;

      // Fetch total read notifications (isRead=true), again using meta.total
      const readResponse = await apiClient.get<Notification[]>(
        `/api/v1/notifications?isRead=true&limit=1`,
      );
      const readCount = readResponse.meta?.total ?? readResponse.data?.length ?? 0;

      const unreadCount = totalCount - readCount;
      return unreadCount > 0 ? unreadCount : 0;
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.put<{ data: Notification }>(
        `/api/v1/notifications/${id}/read`,
        {},
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Also explicitly invalidate unread count query
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message: errorMessage || 'Failed to mark notification as read',
        color: notifyColors.error,
      });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async () => {
      await apiClient.put(`/api/v1/notifications/read-all`, {});
    },
    onSuccess: () => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Also explicitly invalidate unread count query
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      notifications.show({
        title: 'Success',
        message: 'All notifications marked as read',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message: errorMessage || 'Failed to mark all notifications as read',
        color: notifyColors.error,
      });
    },
  });
}

