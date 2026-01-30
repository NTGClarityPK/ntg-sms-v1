import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { LeaveRequest, LeaveQuota, LeaveStatus } from '@/types/leaves';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface QueryLeaveParams {
  page?: number;
  limit?: number;
  studentId?: string;
  status?: LeaveStatus;
  statuses?: LeaveStatus[];
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useLeaveRequests(params?: QueryLeaveParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['leaves', branchId, params],
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

      const response = await apiClient.get<LeaveRequest[]>(
        `/api/v1/leave-requests?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useLeaveQuota(studentId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['leaves', 'quota', studentId, branchId],
    queryFn: async () => {
      if (!studentId || !branchId) return null;
      const response = await apiClient.get<LeaveQuota>(
        `/api/v1/leave-requests/quota/${studentId}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
  });
}

interface CreateLeaveInput {
  studentId: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: CreateLeaveInput) => {
      const response = await apiClient.post<{ data: LeaveRequest }>(
        '/api/v1/leave-requests',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all leave-related queries to ensure fresh data
      queryClient.invalidateQueries({ 
        queryKey: ['leaves'],
        exact: false, // Match all queries starting with 'leaves'
      });
      // Force refetch all leave queries
      queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === 'leaves' && query.queryKey[1] === branchId,
      });
      notifications.show({
        title: 'Success',
        message: 'Leave request submitted',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to submit leave request',
        color: notifyColors.error,
      });
    },
  });
}

export function useUpdateLeaveStatus() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      action: 'approve' | 'reject' | 'cancel';
      reviewNotes?: string;
    }) => {
      const { id, action, reviewNotes } = params;
      const response = await apiClient.put<{ data: LeaveRequest }>(
        `/api/v1/leave-requests/${id}/${action}`,
        reviewNotes ? { reviewNotes } : {},
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      notifications.show({
        title: 'Success',
        message: 'Leave request updated',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to update leave request',
        color: notifyColors.error,
      });
    },
  });
}

export function useStudentLeaveStats(studentId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['leaves', 'stats', studentId, branchId],
    queryFn: async () => {
      if (!studentId || !branchId) return null;
      
      // OPTIMISED: Use dedicated stats endpoint (single request with DB aggregation)
      // instead of 3 separate requests
      const response = await apiClient.get<{
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
      }>(`/api/v1/leave-requests/stats/${studentId}`);
      
      return response.data;
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,  // 2 minutes - stats don't change frequently
  });
}


