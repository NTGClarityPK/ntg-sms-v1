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
import type { Assessment } from '@/types/assessment';

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

/** Published term examinations for the current student session (PIN / switched child). */
export function useStudentExaminationSchedule(enabled = true) {
  return useQuery({
    queryKey: ['student-assessments', 'examination-schedule'],
    queryFn: async (): Promise<Assessment[]> => {
      const response = await apiClient.get<Assessment[]>('/api/v1/student/assessments/examination-schedule');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

export function useExportStudentExaminationSchedulePdf() {
  return useMutation({
    mutationFn: async (params: { language?: string }) => {
      const { language } = params;
      return apiClient.getBlobWithFilename('/api/v1/student/assessments/examination-schedule/export/pdf', {
        params: { ...(language ? { language } : {}) },
      });
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename ?? 'examination-schedule.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not export the PDF. Please try again.';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    },
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
