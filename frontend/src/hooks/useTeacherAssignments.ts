'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  TeacherAssignment,
  CreateTeacherAssignmentInput,
  UpdateTeacherAssignmentInput,
} from '@/types/teacher-assignments';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface QueryTeacherAssignmentsParams {
  page?: number;
  limit?: number;
  staffId?: string;
  subjectId?: string;
  classSectionId?: string;
  academicYearId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useTeacherAssignments(params?: QueryTeacherAssignmentsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { successColor, errorColor } = useThemeColors();

  return useQuery({
    queryKey: ['teacher-assignments', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.staffId) queryParams.append('staffId', params.staffId);
      if (params?.subjectId) queryParams.append('subjectId', params.subjectId);
      if (params?.classSectionId) queryParams.append('classSectionId', params.classSectionId);
      if (params?.academicYearId) queryParams.append('academicYearId', params.academicYearId);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<TeacherAssignment[]>(
        `/api/v1/teacher-assignments?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
  });
}

export function useTeacherAssignment(id: string | null) {
  return useQuery({
    queryKey: ['teacher-assignment', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<{ data: TeacherAssignment }>(
        `/api/v1/teacher-assignments/${id}`,
      );
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateTeacherAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { successColor, errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateTeacherAssignmentInput) => {
      const response = await apiClient.post<{ data: TeacherAssignment }>(
        '/api/v1/teacher-assignments',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Teacher assignment created successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create teacher assignment',
        color: errorColor,
      });
    },
  });
}

export function useUpdateTeacherAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { successColor, errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTeacherAssignmentInput }) => {
      const response = await apiClient.put<{ data: TeacherAssignment }>(
        `/api/v1/teacher-assignments/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', branchId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignment', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'Teacher assignment updated successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update teacher assignment',
        color: errorColor,
      });
    },
  });
}

export function useDeleteTeacherAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { successColor, errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/teacher-assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Teacher assignment deleted successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete teacher assignment',
        color: errorColor,
      });
    },
  });
}

export function useAssignmentsByTeacher(staffId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['teacher-assignments-by-teacher', staffId, branchId, academicYearId],
    queryFn: async () => {
      if (!staffId || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (academicYearId) queryParams.append('academicYearId', academicYearId);

      const response = await apiClient.get<{ data: TeacherAssignment[] }>(
        `/api/v1/teacher-assignments/by-teacher/${staffId}?${queryParams.toString()}`,
      );
      return response.data;
    },
    enabled: !!staffId && !!branchId,
  });
}

export function useAssignmentsByClassSection(classSectionId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['teacher-assignments-by-class', classSectionId, branchId, academicYearId],
    queryFn: async () => {
      if (!classSectionId || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (academicYearId) queryParams.append('academicYearId', academicYearId);

      const response = await apiClient.get<{ data: TeacherAssignment[] }>(
        `/api/v1/teacher-assignments/by-class/${classSectionId}?${queryParams.toString()}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
  });
}

