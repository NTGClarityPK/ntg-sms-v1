import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useAuth } from './useAuth';

export interface ParentAssociation {
  id: string;
  parentUserId: string;
  studentId: string;
  relationship: 'father' | 'mother' | 'guardian';
  isPrimary: boolean;
  canApprove: boolean;
  priority?: number; // 1 = Primary guardian, 2 = Secondary guardian
  createdAt: string;
  parentName?: string;
  studentName?: string;
  studentStudentId?: string;
  parentPhone?: string; // Phone number from profiles table
  parentEmail?: string; // Email from auth.users
}

export interface CreateParentAssociationInput {
  parentUserId: string;
  studentId: string;
  relationship: 'father' | 'mother' | 'guardian';
  isPrimary?: boolean;
  canApprove?: boolean;
  priority?: number; // Optional: if not provided, will be auto-assigned
}

export interface UpdateParentAssociationInput {
  canApprove?: boolean;
}

interface QueryParentAssociationsParams {
  page?: number;
  limit?: number;
  parentId?: string;
  studentId?: string;
  /** Server-side: parent name/email or student name / student ID */
  search?: string;
}

export function useParentAssociations(params?: QueryParentAssociationsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['parent-associations', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.parentId) queryParams.append('parentId', params.parentId);
      if (params?.studentId) queryParams.append('studentId', params.studentId);
      if (params?.search) queryParams.append('search', params.search);

      const response = await apiClient.get<ParentAssociation[]>(
        `/api/v1/parents/associations?${queryParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
  });
}

export function useCreateParentAssociation() {
  const queryClient = useQueryClient();
  const colors = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateParentAssociationInput) => {
      const response = await apiClient.post<ParentAssociation>(
        `/api/v1/parents/${input.parentUserId}/children`,
        {
          studentId: input.studentId,
          relationship: input.relationship,
          isPrimary: input.isPrimary ?? false,
          canApprove: input.canApprove ?? true,
          priority: input.priority,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-associations'] });
      notifications.show({
        title: 'Success',
        message: 'Parent-student association created successfully',
        color: colors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create association',
        color: colors.error,
      });
    },
  });
}

export function useUpdateParentAssociation() {
  const queryClient = useQueryClient();
  const colors = useThemeColors();

  return useMutation({
    mutationFn: async ({
      parentUserId,
      studentId,
      input,
    }: {
      parentUserId: string;
      studentId: string;
      input: UpdateParentAssociationInput;
    }) => {
      const response = await apiClient.put<ParentAssociation>(
        `/api/v1/parents/${parentUserId}/children/${studentId}`,
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-associations'] });
      queryClient.invalidateQueries({ queryKey: ['student-guardians'] });
      notifications.show({
        title: 'Success',
        message: 'Association updated successfully',
        color: colors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update association',
        color: colors.error,
      });
    },
  });
}

export function useDeleteParentAssociation() {
  const queryClient = useQueryClient();
  const colors = useThemeColors();

  return useMutation({
    mutationFn: async ({ parentUserId, studentId }: { parentUserId: string; studentId: string }) => {
      await apiClient.delete(`/api/v1/parents/${parentUserId}/children/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-associations'] });
      queryClient.invalidateQueries({ queryKey: ['student-guardians'] });
      notifications.show({
        title: 'Success',
        message: 'Association removed successfully',
        color: colors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to remove association',
        color: colors.error,
      });
    },
  });
}

/**
 * Hook to get guardians for a specific student (ordered by priority)
 */
export function useStudentGuardians(studentId: string | null | undefined) {
  return useQuery({
    queryKey: ['student-guardians', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const response = await apiClient.get<ParentAssociation[]>(
        `/api/v1/parents/students/${studentId}/guardians`,
      );
      return response;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useParentChildren(parentUserId: string | null | undefined) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['parent-children', branchId, parentUserId],
    queryFn: async () => {
      if (!branchId || !parentUserId) return null;
      const response = await apiClient.get<ParentAssociation[]>(
        `/api/v1/parents/${parentUserId}/children`,
      );
      return response.data;
    },
    enabled: !!branchId && !!parentUserId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

