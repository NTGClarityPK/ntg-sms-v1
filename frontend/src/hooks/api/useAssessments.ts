/**
 * React Query hooks for assessments
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Assessment,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  QueryAssessmentsInput,
  QueryExaminationScheduleInput,
  AssessmentStatistics,
  ClassStatistics,
  SubjectStatistics,
  StudentPerformance,
} from '@/types/assessment';
import type { ApiResponse } from '@/types/api';

export interface AssessmentStudentStatus {
  studentId: string;
  studentUserId: string;
  studentName?: string;
  studentStudentId?: string;
  status?: 'not_started' | 'in_progress' | 'submitted';
  isRead: boolean;
  updatedAt?: string;
}
import { notifications } from '@mantine/notifications';

/**
 * Hook to list assessments with filters and pagination
 */
export function useAssessments(params: QueryAssessmentsInput = {}) {
  return useQuery({
    queryKey: ['assessments', params],
    queryFn: async () => {
      // Backend returns { data: AssessmentDto[], meta: {...} } as ApiResponse payload
      const response = await apiClient.get<Assessment[]>('/api/v1/assessments', {
        params,
      });
      return response;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Published term examinations (examination schedule) for staff users with assessment access.
 */
export function useExaminationSchedule(
  params: QueryExaminationScheduleInput = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['assessments', 'examination-schedule', params],
    queryFn: async () => {
      const response = await apiClient.get<Assessment[]>('/api/v1/assessments/examination-schedule', {
        params,
      });
      return response;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Published term examinations for the signed-in student (parent portal acting as child).
 */
export function useMyExaminationSchedule(
  params: QueryExaminationScheduleInput = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['assessments', 'my', 'examination-schedule', params],
    queryFn: async () => {
      const response = await apiClient.get<Assessment[]>('/api/v1/assessments/my/examination-schedule', {
        params,
      });
      return response;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useExportExaminationSchedulePdf() {
  return useMutation({
    mutationFn: async (params: QueryExaminationScheduleInput & { language?: string }) => {
      const { language, ...rest } = params;
      return apiClient.getBlobWithFilename('/api/v1/assessments/examination-schedule/export/pdf', {
        params: { ...rest, ...(language ? { language } : {}) },
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
  });
}

/**
 * Hook to get a single assessment by ID
 */
export function useAssessment(id: string | undefined) {
  return useQuery({
    queryKey: ['assessments', id],
    queryFn: async () => {
      // Backend returns { data: Assessment }
      // apiClient.get<Assessment>() returns ApiResponse<Assessment> = { data: Assessment }
      const response = await apiClient.get<Assessment>(`/api/v1/assessments/${id}`);
      return response.data; // Returns Assessment directly
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to create a new assessment
 */
export function useCreateAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAssessmentInput) => {
      const response = await apiClient.post<ApiResponse<Assessment>>('/api/v1/assessments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment created successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to create assessment',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to update an existing assessment
 */
export function useUpdateAssessment(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAssessmentInput) => {
      const response = await apiClient.put<ApiResponse<Assessment>>(`/api/v1/assessments/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment updated successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update assessment',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to delete an assessment
 */
export function useDeleteAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse<{ id: string }>>(`/api/v1/assessments/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment deleted successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      // Extract error message from various possible locations
      // Backend HttpExceptionFilter returns: { error: { code, message } }
      // Axios wraps it in error.response.data
      let errorMessage = 'Failed to delete assessment';
      
      try {
        // Handle AxiosError (most common case)
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { data?: any } };
          const responseData = axiosError.response?.data;
          
          // Debug log in development
          if (process.env.NODE_ENV === 'development') {
            console.log('[Delete Assessment Error] Full error:', error);
            console.log('[Delete Assessment Error] Response data:', responseData);
            console.log('[Delete Assessment Error] Error structure:', {
              hasResponse: 'response' in error,
              responseData,
              errorPath: responseData?.error,
              messagePath: responseData?.error?.message,
            });
          }
          
          if (responseData) {
            // Try nested error object first (NestJS HttpExceptionFilter format: { error: { code, message } })
            if (responseData.error?.message) {
              errorMessage = String(responseData.error.message);
            }
            // Try top-level message
            else if (responseData.message) {
              errorMessage = String(responseData.message);
            }
            // Try error as string
            else if (typeof responseData.error === 'string') {
              errorMessage = responseData.error;
            }
          }
        }
        // Handle generic Error
        else if (error instanceof Error) {
          errorMessage = error.message;
        }
        // Handle string errors
        else if (typeof error === 'string') {
          errorMessage = error;
        }
      } catch (e) {
        // If extraction fails, use default message
        console.error('Error extracting error message:', e);
      }
      
      notifications.show({
        title: 'Cannot Delete Assessment',
        message: errorMessage,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to publish an assessment
 */
export function usePublishAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, publishDate }: { id: string; publishDate?: string }) => {
      const response = await apiClient.post<ApiResponse<Assessment>>(`/api/v1/assessments/${id}/publish`, {
        publishDate,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment published successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to publish assessment',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to get assessment statistics
 */
export function useAssessmentStatistics(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', assessmentId, 'statistics'],
    queryFn: async () => {
      // Backend returns { data: AssessmentStatistics }
      // apiClient.get<AssessmentStatistics>() returns ApiResponse<AssessmentStatistics> = { data: AssessmentStatistics }
      const response = await apiClient.get<AssessmentStatistics>(
        `/api/v1/assessments/${assessmentId}/statistics`,
      );
      return response.data; // Returns AssessmentStatistics directly
    },
    enabled: !!assessmentId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get per-student assessment status for statistics view
 */
export function useAssessmentStudentStatus(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', assessmentId, 'student-status'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AssessmentStudentStatus[]>>(
        `/api/v1/assessments/${assessmentId}/student-status`,
      );
      return response.data;
    },
    enabled: !!assessmentId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get class statistics
 */
export function useClassStatistics(classSectionId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', 'class', classSectionId, 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ClassStatistics>>(
        `/api/v1/assessments/class/${classSectionId}/statistics`,
      );
      return response.data;
    },
    enabled: !!classSectionId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get subject statistics
 */
export function useSubjectStatistics(subjectId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', 'subject', subjectId, 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<SubjectStatistics>>(
        `/api/v1/assessments/subject/${subjectId}/statistics`,
      );
      return response.data;
    },
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get student performance summary
 */
export function useStudentPerformance(studentId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', 'student', studentId, 'performance'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<StudentPerformance>>(
        `/api/v1/assessments/student/${studentId}/performance`,
      );
      return response.data;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60, // 1 minute
  });
}

