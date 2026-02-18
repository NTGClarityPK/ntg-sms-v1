import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type {
  UniformRequest,
  CreateUniformRequestInput,
  QueryUniformRequestsParams,
} from '@/types/inventory';

export function useUniformRequests(params: QueryUniformRequestsParams = {}) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniform-requests', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.studentId) queryParams.append('studentId', params.studentId);
      if (params.status && params.status.length > 0) {
        params.status.forEach((s) => queryParams.append('status', s));
      }
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<UniformRequest[]>(
        `/api/v1/uniform-requests?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUniformRequest(id: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniform-requests', id, branchId],
    queryFn: async () => {
      if (!id || !branchId) return null;
      const response = await apiClient.get<UniformRequest>(
        `/api/v1/uniform-requests/${id}`,
      );
      return response.data;
    },
    enabled: !!id && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateUniformRequest() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateUniformRequestInput) => {
      const response = await apiClient.post<UniformRequest>(
        '/api/v1/uniform-requests',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uniform-requests'] });
      notifications.show({ title: 'Request submitted', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to submit request',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useApproveUniformRequest() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: { id: string; notes?: string }) => {
      const response = await apiClient.put<UniformRequest>(
        `/api/v1/uniform-requests/${id}/approve`,
        { notes },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uniform-requests'] });
      queryClient.invalidateQueries({
        queryKey: ['uniform-requests', variables.id],
      });
      notifications.show({ title: 'Request approved', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to approve',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useRejectUniformRequest() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: { id: string; notes?: string }) => {
      const response = await apiClient.put<UniformRequest>(
        `/api/v1/uniform-requests/${id}/reject`,
        { notes },
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uniform-requests'] });
      queryClient.invalidateQueries({
        queryKey: ['uniform-requests', variables.id],
      });
      notifications.show({ title: 'Request rejected', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to reject',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useIssueUniformRequest() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.put<UniformRequest>(
        `/api/v1/uniform-requests/${id}/issue`,
        {},
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['uniform-requests'] });
      queryClient.invalidateQueries({ queryKey: ['uniform-issuances'] });
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      queryClient.invalidateQueries({ queryKey: ['uniforms', 'low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['uniform-requests', id] });
      notifications.show({ title: 'Request issued', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to issue',
        message: error.message,
        color: errorColor,
      });
    },
  });
}

export function useCancelUniformRequest() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.put<UniformRequest>(
        `/api/v1/uniform-requests/${id}/cancel`,
        {},
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['uniform-requests'] });
      queryClient.invalidateQueries({ queryKey: ['uniform-requests', id] });
      notifications.show({ title: 'Request cancelled', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to cancel',
        message: error.message,
        color: errorColor,
      });
    },
  });
}
