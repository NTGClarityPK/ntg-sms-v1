'use client';

/**
 * React Query hooks for student assessments accessed via student JWT.
 * Used when a parent has switched to a child, or a student logged in via PIN.
 * Routes go to /api/v1/student/... which is protected by StudentJwtGuard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import type {
  MyAssessment,
  MyAssessmentStatus,
  StudentAssessmentStatusValue,
} from './useMyAssessments';

export function useStudentAssessments(enabled = true) {
  return useQuery({
    queryKey: ['student-assessments'],
    queryFn: async (): Promise<MyAssessment[]> => {
      const response = await apiClient.get<MyAssessment[]>('/api/v1/student/assessments');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

export function useUpdateStudentAssessmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assessmentId: string;
      status?: StudentAssessmentStatusValue;
      isRead?: boolean;
    }): Promise<MyAssessmentStatus> => {
      const { assessmentId, status, isRead } = params;
      const response = await apiClient.post<MyAssessmentStatus>(
        `/api/v1/student/assessments/${assessmentId}/status`,
        { status, isRead },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-assessments'] });
      notifications.show({
        title: 'Updated',
        message: 'Assessment status updated',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update assessment status';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    },
  });
}
