import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  EarlyDepartureRequest,
  EarlyDepartureStatus,
} from '@/types/early-departure';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface QueryEarlyDepartureParams {
  page?: number;
  limit?: number;
  studentId?: string;
  status?: EarlyDepartureStatus;
  statuses?: EarlyDepartureStatus[];
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useEarlyDepartures(params?: QueryEarlyDepartureParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['early-departures', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.studentId) queryParams.append('studentId', params.studentId);
      if (params?.statuses && params.statuses.length > 0) {
        params.statuses.forEach((s) => queryParams.append('status', s));
      } else if (params?.status) {
        queryParams.append('status', params.status);
      }
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<EarlyDepartureRequest[]>(
        `/api/v1/early-departures?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
  });
}

interface CreateEarlyDepartureInput {
  studentId: string;
  date: string;
  departureTime: string;
  reason?: string;
  attachmentUrl?: string;
}

export function useCreateEarlyDeparture() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateEarlyDepartureInput) => {
      const response = await apiClient.post<{ data: EarlyDepartureRequest }>(
        '/api/v1/early-departures',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['early-departures'] });
      notifications.show({
        title: 'Success',
        message: 'Early departure request submitted',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to submit early departure request',
        color: notifyColors.error,
      });
    },
  });
}

export function useUpdateEarlyDepartureStatus() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      action: 'approve' | 'reject';
      reviewNotes?: string;
    }) => {
      const { id, action, reviewNotes } = params;
      const response = await apiClient.put<{ data: EarlyDepartureRequest }>(
        `/api/v1/early-departures/${id}/${action}`,
        reviewNotes ? { reviewNotes } : {},
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['early-departures'] });
      notifications.show({
        title: 'Success',
        message: 'Early departure request updated',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to update early departure request',
        color: notifyColors.error,
      });
    },
  });
}


