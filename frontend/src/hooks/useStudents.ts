import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Student, CreateStudentInput, UpdateStudentInput } from '@/types/students';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';

interface QueryStudentsParams {
  page?: number;
  limit?: number;
  classId?: string; // Deprecated: use classIds instead
  classIds?: string[]; // Array of class IDs
  sectionId?: string; // Deprecated: use sectionIds instead
  sectionIds?: string[]; // Array of section IDs
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useStudents(params?: QueryStudentsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['students', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      // Support both single (backward compatibility) and multiple filters
      if (params?.classIds && params.classIds.length > 0) {
        params.classIds.forEach((classId) => queryParams.append('classIds', classId));
      } else if (params?.classId) {
        queryParams.append('classId', params.classId);
      }
      if (params?.sectionIds && params.sectionIds.length > 0) {
        params.sectionIds.forEach((sectionId) => queryParams.append('sectionIds', sectionId));
      } else if (params?.sectionId) {
        queryParams.append('sectionId', params.sectionId);
      }
      if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      // Backend service returns { data: StudentDto[], meta: {...} }
      // Controller returns it directly: { data: StudentDto[], meta: {...} }
      // ResponseInterceptor sees it has 'data' property and returns as-is: { data: StudentDto[], meta: {...} }
      // HTTP response body: { data: StudentDto[], meta: {...} }
      // Axios response.data: { data: StudentDto[], meta: {...} }
      // apiClient.get() returns response.data, which is { data: StudentDto[], meta: {...} }
      // apiClient.get<Student[]>() returns ApiResponse<Student[]>, which is { data: Student[], meta?: {...}, error?: {...} }
      // But the actual HTTP response is { data: StudentDto[], meta: {...} }, so response = { data: StudentDto[], meta: {...} }
      const response = await apiClient.get<Student[]>(`/api/v1/students?${queryParams.toString()}`);
      // response is ApiResponse<Student[]>, which is { data: Student[], meta?: {...}, error?: {...} }
      // But the actual HTTP response is { data: StudentDto[], meta: {...} }, so response = { data: StudentDto[], meta: {...} }
      // We want to return { data: Student[], meta: {...} }
      return response;
    },
    enabled: !!branchId,
  });
}

export function useStudent(id: string | null) {
  return useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<{ data: Student }>(`/api/v1/students/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useGenerateStudentId() {
  return useMutation({
    mutationFn: async (params: { classId?: string; sectionId?: string; academicYearId?: string }) => {
      const queryParams = new URLSearchParams();
      if (params.classId) queryParams.append('classId', params.classId);
      if (params.sectionId) queryParams.append('sectionId', params.sectionId);
      if (params.academicYearId) queryParams.append('academicYearId', params.academicYearId);

      const response = await apiClient.get<{ data: { studentId: string } }>(
        `/api/v1/students/generate-id?${queryParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      const response = await apiClient.post<{ data: Student }>('/api/v1/students', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', branchId] });
      notifications.show({
        title: 'Success',
        message: 'Student created successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create student',
        color: 'red',
      });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateStudentInput }) => {
      const response = await apiClient.put<{ data: Student }>(`/api/v1/students/${id}`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students', branchId] });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
      notifications.show({
        title: 'Success',
        message: 'Student updated successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update student',
        color: 'red',
      });
    },
  });
}

