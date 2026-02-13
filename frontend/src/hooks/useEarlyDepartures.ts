import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  EarlyDepartureRequest,
  EarlyDepartureStatus,
} from '@/types/early-departure';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

/** Extract backend error message from Axios response. Nest HttpExceptionFilter returns { error: { code, message } }. */
function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const res = (error as { response?: { data?: { error?: { message?: string | string[] }; message?: string | string[] } } })
      .response?.data;
    const msg = res?.error?.message ?? res?.message;
    if (msg) return Array.isArray(msg) ? msg.join(', ') : msg;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['early-departures'] });
      // Invalidate stats for the student
      if (data.data?.studentId) {
        queryClient.invalidateQueries({ queryKey: ['early-departures', 'stats', data.data.studentId] });
      }
      notifications.show({
        title: 'Success',
        message: 'Early departure request submitted',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(
        error,
        'Failed to submit early departure request',
      );
      notifications.show({
        title: 'Error',
        message,
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
      action: 'approve' | 'reject' | 'cancel';
      reviewNotes?: string;
    }) => {
      const { id, action, reviewNotes } = params;
      
      if (action === 'cancel') {
        const response = await apiClient.put<{ data: EarlyDepartureRequest }>(
          `/api/v1/early-departures/${id}/cancel`,
          {},
        );
        return response.data;
      }
      
      const response = await apiClient.put<{ data: EarlyDepartureRequest }>(
        `/api/v1/early-departures/${id}/${action}`,
        reviewNotes ? { reviewNotes } : {},
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['early-departures'] });
      // Invalidate stats if studentId is available
      queryClient.invalidateQueries({ queryKey: ['early-departures', 'stats'] });
      const message = variables.action === 'cancel' 
        ? 'Early departure request cancelled'
        : 'Early departure request updated';
      notifications.show({
        title: 'Success',
        message,
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(
        error,
        'Failed to update early departure request',
      );
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
    },
  });
}

export function useStudentEarlyDepartureStats(studentId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['early-departures', 'stats', studentId, branchId],
    queryFn: async () => {
      if (!studentId || !branchId) return null;

      const [pendingResponse, rejectedResponse, approvedResponse] = await Promise.all([
        apiClient.get<EarlyDepartureRequest[]>(
          `/api/v1/early-departures?studentId=${studentId}&status=pending&limit=1`,
        ),
        apiClient.get<EarlyDepartureRequest[]>(
          `/api/v1/early-departures?studentId=${studentId}&status=rejected&limit=1`,
        ),
        apiClient.get<EarlyDepartureRequest[]>(
          `/api/v1/early-departures?studentId=${studentId}&status=approved&limit=1`,
        ),
      ]);

      const pending = pendingResponse.meta?.total || 0;
      const rejected = rejectedResponse.meta?.total || 0;
      const approved = approvedResponse.meta?.total || 0;

      return { pending, rejected, approved };
    },
    enabled: !!studentId && !!branchId,
  });
}



