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

      // Backend returns: { data: NotificationDto[]; meta: {...} }
      // apiClient.get<Notification[]> returns ApiResponse<Notification[]> = { data: Notification[], meta: {...} }
      const response = await apiClient.get<Notification[]>(
        `/api/v1/notifications?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
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
      return response;
    },
    enabled: !!id && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - single notification rarely changes
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: async () => {
      if (!userId) return 0;

      const response = await apiClient.get<{ unreadCount: number }>(
        `/api/v1/notifications/unread-count`,
      );

      const unreadCount = (response as unknown as { data: { unreadCount: number } }).data?.unreadCount ?? 0;
      return unreadCount > 0 ? unreadCount : 0;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - unread count needs to be fresh
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
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] });
      }
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
      if (userId) {
        queryClient.setQueryData<number>(['notifications', 'unread-count', userId], 0);
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', userId] });
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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

