import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Student,
  CreateStudentInput,
  CreateStudentWithInvitationInput,
  UpdateStudentInput,
} from '@/types/students';
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
  enrolmentStatuses?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
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
      if (params?.enrolmentStatuses?.length) {
        params.enrolmentStatuses.forEach((status) =>
          queryParams.append('enrolmentStatuses', status),
        );
      }
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
    enabled: !!branchId && (params?.enabled !== false),
    staleTime: 2 * 60 * 1000,  // 2 minutes - student list rarely changes mid-session
  });
}

export function useStudent(id: string | null) {
  return useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      if (!id) return null;
      // Backend returns { data: StudentDto }, so apiClient.get<Student> returns ApiResponse<Student>
      // which is { data: Student, meta?, error? }
      const response = await apiClient.get<Student>(`/api/v1/students/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - single student rarely changes
  });
}

export function useMyStudent() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['student', 'me', branchId],
    queryFn: async () => {
      if (!branchId) {
        return null;
      }

      try {
        // Get current student from profile's current_student_id or user_id link
        const response = await apiClient.get<{ id: string; studentId: string; firstName: string; lastName: string } | null>(
          '/api/v1/auth/current-child',
        );
        const currentChild = response.data;

        if (!currentChild?.id) {
          return null;
        }

        const studentResponse = await apiClient.get<Student>(`/api/v1/students/${currentChild.id}`);
        return studentResponse;
      } catch (error) {
        console.error('[useMyStudent] Error:', error);
        throw error;
      }
    },
    enabled: !!branchId && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
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

export interface ReinviteStudentInput {
  username: string;
  invitationRecipientEmail: string;
  invitationType: 'parent' | 'student';
}

export function useReinviteStudentAfterExpiry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async ({
      studentId,
      input,
    }: {
      studentId: string;
      input: ReinviteStudentInput;
    }) => {
      const response = await apiClient.post<{
        student: Student;
        studentInvitation: {
          token: string;
          recipientEmail: string;
          invitationType: 'parent' | 'student';
          expiresAt: string;
        };
      }>(`/api/v1/students/${studentId}/reinvite-invitation`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', branchId] });
      notifications.show({
        title: 'Success',
        message: 'New invitation sent successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to send invitation',
        color: 'red',
      });
    },
  });
}

export function useCreateStudentWithInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: CreateStudentWithInvitationInput) => {
      const response = await apiClient.post<{
        student: Student;
        studentInvitation: {
          token: string;
          recipientEmail: string;
          invitationType: 'parent' | 'student';
          expiresAt: string;
        };
        parentInvitation?: {
          token: string;
          recipientEmail: string;
          expiresAt: string;
          parentUserId: string;
        };
      }>('/api/v1/students/with-invitation', input);

      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students', branchId] });
      notifications.show({
        title: 'Success',
        message: `Invitation sent to ${result.studentInvitation.recipientEmail}`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to send invitation',
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students', branchId] });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
      // Invalidate all student template queries for this student (covers all academic years)
      if (variables.input.subjectTemplateId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: ['subject-templates', 'student', variables.id],
        });
      }
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

