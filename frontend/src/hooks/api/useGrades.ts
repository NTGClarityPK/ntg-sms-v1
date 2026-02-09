/**
 * React Query hooks for student grades
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  StudentGrade,
  CreateStudentGradeInput,
  BulkCreateGradesInput,
  UpdateStudentGradeInput,
  QueryGradesInput,
  BulkGradeError,
} from '@/types/assessment';
import type { ApiResponse, PaginatedApiResponse } from '@/types/api';
import { notifications } from '@mantine/notifications';

/**
 * Hook to query grades with filters and pagination
 */
export function useGrades(params: QueryGradesInput = {}) {
  return useQuery({
    queryKey: ['grades', params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedApiResponse<StudentGrade>>('/api/v1/grades', {
        params,
      });
      return response;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get grades for a specific assessment
 */
export function useAssessmentGrades(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ['grades', 'assessment', assessmentId],
    queryFn: async () => {
      // Backend returns { data: StudentGrade[] }
      // apiClient.get<StudentGrade[]>() returns ApiResponse<StudentGrade[]> = { data: StudentGrade[] }
      const response = await apiClient.get<StudentGrade[]>(
        `/api/v1/grades/assessment/${assessmentId}`,
      );
      return response.data; // Returns StudentGrade[] directly
    },
    enabled: !!assessmentId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get grades for a specific student
 */
export function useStudentGrades(studentId: string | undefined) {
  return useQuery({
    queryKey: ['grades', 'student', studentId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<StudentGrade[]>>(`/api/v1/grades/student/${studentId}`);
      return response.data;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to create a single grade
 */
export function useCreateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStudentGradeInput) => {
      const response = await apiClient.post<ApiResponse<StudentGrade>>('/api/v1/grades', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Grade saved successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save grade',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to bulk create grades for multiple students
 */
export function useBulkCreateGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkCreateGradesInput) => {
      // Backend controller returns: { data: StudentGradeDto[], errors: [...] }
      // ResponseInterceptor sees it has 'data' property, passes through as-is
      // apiClient.post() returns ApiResponse<T> which is { data: T }
      // So response.data is { data: [...], errors: [...] }
      const response = await apiClient.post<{
        data: StudentGrade[];
        errors: BulkGradeError[];
      }>('/api/v1/grades/bulk', data);
      
      // response is ApiResponse<{ data: [...], errors: [...] }>
      // response.data is { data: [...], errors: [...] }
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });

      // Debug logging - always log to help diagnose
      console.log('[BulkCreateGrades] Success result:', JSON.stringify(result, null, 2));
      console.log('[BulkCreateGrades] Result type:', typeof result);
      console.log('[BulkCreateGrades] Result keys:', result ? Object.keys(result) : 'null');
      console.log('[BulkCreateGrades] result.data:', result?.data);
      console.log('[BulkCreateGrades] result.errors:', result?.errors);
      console.log('[BulkCreateGrades] Is result.data an array?', Array.isArray(result?.data));
      console.log('[BulkCreateGrades] Is result.errors an array?', Array.isArray(result?.errors));

      // The backend returns { data: [...], errors: [...] }
      // After ResponseInterceptor: { data: [...], errors: [...] } (passed through)
      // After apiClient.post(): { data: { data: [...], errors: [...] } }
      // After return response.data: { data: [...], errors: [...] }
      // So result should be { data: [...], errors: [...] }
      
      // Handle the actual response structure
      let grades: StudentGrade[] = [];
      let errors: BulkGradeError[] = [];

      if (result) {
        // Case 1: result is { data: [...], errors: [...] }
        if (Array.isArray(result.data) && Array.isArray(result.errors)) {
          grades = result.data;
          errors = result.errors;
        }
        // Case 2: result is wrapped in another data property: { data: { data: [...], errors: [...] } }
        else if (result.data && typeof result.data === 'object' && 'data' in result.data) {
          const innerData = (result.data as any).data;
          const innerErrors = (result.data as any).errors;
          if (Array.isArray(innerData)) grades = innerData;
          if (Array.isArray(innerErrors)) errors = innerErrors;
        }
        // Case 3: result itself is the array (shouldn't happen but handle it)
        else if (Array.isArray(result)) {
          grades = result;
        }
      }

      const successCount = grades.length;
      const errorCount = errors.length;

      console.log('[BulkCreateGrades] Final parsed - successCount:', successCount, 'errorCount:', errorCount);

      if (errorCount === 0 && successCount > 0) {
        notifications.show({
          title: 'Success',
          message: `${successCount} grades saved successfully`,
          color: 'green',
        });
      } else if (successCount > 0) {
        notifications.show({
          title: 'Partial Success',
          message: `${successCount} grades saved, ${errorCount} failed`,
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to save all grades',
          color: 'red',
        });
      }
    },
    onError: (error: any) => {
      // Log full error for debugging
      console.error('[BulkCreateGrades] Error:', error);
      console.error('[BulkCreateGrades] Error response:', error.response);
      console.error('[BulkCreateGrades] Error response data:', error.response?.data);
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || error.response?.data?.error?.message || 'Failed to save grades',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to update a grade
 */
export function useUpdateGrade(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateStudentGradeInput) => {
      const response = await apiClient.put<ApiResponse<StudentGrade>>(`/api/v1/grades/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Grade updated successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update grade',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to delete a grade
 */
export function useDeleteGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<ApiResponse<{ id: string }>>(`/api/v1/grades/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Grade deleted successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete grade',
        color: 'red',
      });
    },
  });
}

