'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { StorageOverview, StorageBreakdown, FileSummary, StorageAlert } from '@/types/storage';

export function useStorageOverview() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['storage', 'overview', branchId],
    queryFn: async (): Promise<StorageOverview> => {
      const response = await apiClient.get<StorageOverview>('/api/v1/storage');
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStorageBreakdown() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['storage', 'breakdown', branchId],
    queryFn: async (): Promise<StorageBreakdown> => {
      const response = await apiClient.get<StorageBreakdown>('/api/v1/storage/breakdown');
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useRefreshStorageBreakdown() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (): Promise<StorageBreakdown> => {
      const response = await apiClient.post<StorageBreakdown>('/api/v1/storage/breakdown/refresh');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      notifications.show({ title: 'Breakdown refreshed', message: '', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ title: 'Failed to refresh', message: error.message, color: 'red' });
    },
  });
}

export function useStorageFiles(params?: { limit?: number; source?: 'library' | 'assessment' | 'uniform' }) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['storage', 'files', branchId, params?.limit, params?.source],
    queryFn: async (): Promise<FileSummary[]> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.source) searchParams.set('source', params.source);
      const qs = searchParams.toString();
      const response = await apiClient.get<FileSummary[]>(`/api/v1/storage/files${qs ? `?${qs}` : ''}`);
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDeleteStorageFile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({
      id,
      source,
    }: {
      id: string;
      source: 'library' | 'assessment' | 'uniform';
    }): Promise<void> => {
      await apiClient.delete(`/api/v1/storage/files/${id}?source=${source}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      notifications.show({ title: 'File deleted', message: '', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ title: 'Delete failed', message: error.message, color: 'red' });
    },
  });
}

export function useStorageAlerts(filter?: 'warning' | 'critical' | 'exceeded' | 'unacknowledged') {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['storage', 'alerts', branchId, filter],
    queryFn: async (): Promise<StorageAlert[]> => {
      const qs = filter ? `?filter=${filter}` : '';
      const response = await apiClient.get<StorageAlert[]>(`/api/v1/storage/alerts${qs}`);
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 1 * 60 * 1000,
  });
}

export function useAcknowledgeStorageAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (alertId: string): Promise<StorageAlert> => {
      const response = await apiClient.put<StorageAlert>(
        `/api/v1/storage/alerts/${alertId}/acknowledge`,
        {},
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      notifications.show({ title: 'Alert acknowledged', message: '', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ title: 'Failed to acknowledge', message: error.message, color: 'red' });
    },
  });
}
