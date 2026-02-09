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
      const response = await apiClient.post<{
        data: StudentGrade[];
        errors: BulkGradeError[];
      }>('/api/v1/grades/bulk', data);
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });

      const successCount = result.data.length;
      const errorCount = result.errors.length;

      if (errorCount === 0) {
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
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save grades',
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

