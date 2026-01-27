'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ClassSection,
  CreateClassSectionInput,
  BulkCreateClassSectionInput,
  UpdateClassSectionInput,
  AssignClassTeacherInput,
  ClassSectionStudent,
} from '@/types/class-sections';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface QueryClassSectionsParams {
  page?: number;
  limit?: number;
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useClassSections(params?: QueryClassSectionsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useQuery({
    queryKey: ['class-sections', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.classId) queryParams.append('classId', params.classId);
      if (params?.sectionId) queryParams.append('sectionId', params.sectionId);
      if (params?.academicYearId) queryParams.append('academicYearId', params.academicYearId);
      if (params?.isActive !== undefined)
        queryParams.append('isActive', params.isActive.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get<ClassSection[]>(
        `/api/v1/class-sections?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
  });
}

export function useClassSection(id: string | null) {
  return useQuery({
    queryKey: ['class-section', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<{ data: ClassSection }>(`/api/v1/class-sections/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateClassSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateClassSectionInput) => {
      const response = await apiClient.post<{ data: ClassSection }>(
        '/api/v1/class-sections',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-sections', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Class section created successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create class section',
        color: errorColor,
      });
    },
  });
}

export function useBulkCreateClassSections() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: BulkCreateClassSectionInput) => {
      const response = await apiClient.post<{ data: ClassSection[] }>(
        '/api/v1/class-sections',
        input,
      );
      return response.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['class-sections', branchId] });
      notifications.show({
        title: 'Success',
        message: `${data?.length || 0} class section(s) created successfully`,
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create class sections',
        color: errorColor,
      });
    },
  });
}

export function useUpdateClassSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateClassSectionInput }) => {
      const response = await apiClient.put<{ data: ClassSection }>(
        `/api/v1/class-sections/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-sections', branchId] });
      queryClient.invalidateQueries({ queryKey: ['class-section', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'Class section updated successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update class section',
        color: errorColor,
      });
    },
  });
}

export function useDeleteClassSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/class-sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-sections', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Class section deleted successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete class section',
        color: errorColor,
      });
    },
  });
}

export function useClassSectionStudents(id: string | null) {
  return useQuery({
    queryKey: ['class-section-students', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<{ data: ClassSectionStudent[] }>(
        `/api/v1/class-sections/${id}/students`,
      );
      return response.data;
    },
    enabled: !!id,
  });
}

export function useAssignClassTeacher() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AssignClassTeacherInput }) => {
      const response = await apiClient.put<{ data: ClassSection }>(
        `/api/v1/class-sections/${id}/class-teacher`,
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-sections', branchId] });
      queryClient.invalidateQueries({ queryKey: ['class-section', variables.id] });
      notifications.show({
        title: 'Success',
        message: variables.input.staffId
          ? 'Class teacher assigned successfully'
          : 'Class teacher unassigned successfully',
        color: successColor,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to assign class teacher',
        color: errorColor,
      });
    },
  });
}

