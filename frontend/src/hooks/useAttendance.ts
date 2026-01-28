import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Attendance,
  CreateAttendanceInput,
  BulkMarkAttendanceInput,
  UpdateAttendanceInput,
  AttendanceSummary,
  AttendanceReport,
  AttendanceStatus,
} from '@/types/attendance';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface QueryAttendanceParams {
  page?: number;
  limit?: number;
  date?: string;
  classSectionId?: string;
  classSectionIds?: string[];
  studentId?: string;
  status?: string;
  statuses?: AttendanceStatus[];
  academicYearId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useAttendance(params?: QueryAttendanceParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['attendance', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.date) queryParams.append('date', params.date);
      if (params?.classSectionIds && params.classSectionIds.length > 0) {
        params.classSectionIds.forEach((id) =>
          queryParams.append('classSectionIds', id),
        );
      } else if (params?.classSectionId) {
        queryParams.append('classSectionId', params.classSectionId);
      }
      if (params?.studentId) queryParams.append('studentId', params.studentId);
      if (params?.statuses && params.statuses.length > 0) {
        params.statuses.forEach((status) =>
          queryParams.append('statuses', status),
        );
      } else if (params?.status) {
        queryParams.append('status', params.status);
      }
      if (params?.academicYearId)
        queryParams.append('academicYearId', params.academicYearId);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      // Use apiClient.get<Attendance[]>() as per mistakes.md lesson
      const response = await apiClient.get<Attendance[]>(
        `/api/v1/attendance?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
  });
}

export function useAttendanceByClassAndDate(
  classSectionId: string | null,
  date: string | null,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['attendance', 'class', classSectionId, date, branchId],
    queryFn: async () => {
      if (!classSectionId || !date || !branchId) return null;
      const response = await apiClient.get<Attendance[]>(
        `/api/v1/attendance/class/${classSectionId}/date/${date}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!date && !!branchId,
  });
}

export function useAttendanceByStudent(
  studentId: string | null,
  startDate?: string,
  endDate?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['attendance', 'student', studentId, startDate, endDate, branchId],
    queryFn: async () => {
      if (!studentId || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const response = await apiClient.get<Attendance[]>(
        `/api/v1/attendance/student/${studentId}?${queryParams.toString()}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
  });
}

export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (input: BulkMarkAttendanceInput) => {
      const response = await apiClient.post<Attendance[]>(
        '/api/v1/attendance/bulk',
        input,
        // Bulk attendance can take longer than normal requests (large class sizes, extra server work).
        { timeout: 30000 },
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate broadly to refresh both list and class/date views.
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      notifications.show({
        title: 'Success',
        message: 'Attendance marked successfully',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout =
        typeof errorMessage === 'string' &&
        (errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNABORTED'));

      if (isTimeout) {
        notifications.show({
          title: 'Saving is taking longer than expected',
          message:
            'Your attendance may still have been saved. Refreshing data…',
          color: notifyColors.warning,
        });
        // Best-effort refresh shortly after; backend may still be finishing.
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
        }, 1500);
        return;
      }
      notifications.show({
        title: 'Error',
        message: errorMessage || 'Failed to mark attendance',
        color: notifyColors.error,
      });
    },
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateAttendanceInput;
    }) => {
      const response = await apiClient.put<Attendance>(
        `/api/v1/attendance/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', branchId] });
      queryClient.invalidateQueries({
        queryKey: ['attendance', 'student', variables.id],
      });
      notifications.show({
        title: 'Success',
        message: 'Attendance updated successfully',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message: errorMessage || 'Failed to update attendance',
        color: notifyColors.error,
      });
    },
  });
}

export function useAttendanceSummaryByStudent(studentId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['attendance', 'summary', 'student', studentId, branchId],
    queryFn: async () => {
      if (!studentId || !branchId) return null;
      const response = await apiClient.get<AttendanceSummary>(
        `/api/v1/attendance/summary/student/${studentId}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
  });
}

export function useAttendanceSummaryByClass(
  classSectionId: string | null,
  startDate?: string,
  endDate?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: [
      'attendance',
      'summary',
      'class',
      classSectionId,
      startDate,
      endDate,
      branchId,
    ],
    queryFn: async () => {
      if (!classSectionId || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const response = await apiClient.get<AttendanceSummary>(
        `/api/v1/attendance/summary/class/${classSectionId}?${queryParams.toString()}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
  });
}

export function useAttendanceReport(params?: QueryAttendanceParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['attendance', 'report', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.classSectionId)
        queryParams.append('classSectionId', params.classSectionId);
      if (params?.date) queryParams.append('date', params.date);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.studentId) queryParams.append('studentId', params.studentId);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.academicYearId)
        queryParams.append('academicYearId', params.academicYearId);

      const response = await apiClient.get<AttendanceReport>(
        `/api/v1/attendance/report?${queryParams.toString()}`,
      );
      return response.data;
    },
    enabled: !!branchId,
  });
}

