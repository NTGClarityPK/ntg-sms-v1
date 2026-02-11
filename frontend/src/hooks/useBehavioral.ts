'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  PendingStudent,
  BehavioralAssessment,
  BehavioralMatrixResponse,
  CreateBehavioralAssessmentInput,
  UpdateBehavioralAssessmentInput,
} from '@/types/behavioral';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

/**
 * Pending students for current month (no meta) → return response.data.
 */
export function usePendingBehavioral() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['behavioral', 'pending', branchId],
    queryFn: async (): Promise<PendingStudent[]> => {
      if (!branchId) return [];
      const response = await apiClient.get<PendingStudent[]>('/api/v1/behavioral/pending');
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Behavioral history for a student (no meta) → return response.data.
 */
export function useBehavioralByStudent(studentId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['behavioral', 'student', studentId, academicYearId, branchId],
    queryFn: async (): Promise<BehavioralAssessment[]> => {
      if (!studentId || !branchId) return [];
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<BehavioralAssessment[]>(
        `/api/v1/behavioral/student/${studentId}${params}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Matrix view for a class section (no meta) → return response.data.
 */
export function useBehavioralMatrix(classSectionId: string | null, month?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['behavioral', 'matrix', classSectionId, month, branchId],
    queryFn: async (): Promise<BehavioralMatrixResponse | null> => {
      if (!classSectionId || !branchId) return null;
      const params = month ? `?month=${encodeURIComponent(month)}` : '';
      const response = await apiClient.get<BehavioralMatrixResponse>(
        `/api/v1/behavioral/matrix/${classSectionId}${params}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Create behavioral assessment. Mutation → return response.data.
 */
export function useCreateBehavioralMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateBehavioralAssessmentInput) => {
      const response = await apiClient.post<BehavioralAssessment>(
        '/api/v1/behavioral',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment saved successfully',
        color: successColor,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to save assessment',
        color: errorColor,
      });
    },
  });
}

/**
 * Update behavioral assessment. Mutation → return response.data.
 */
export function useUpdateBehavioralMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateBehavioralAssessmentInput;
    }) => {
      const response = await apiClient.put<BehavioralAssessment>(
        `/api/v1/behavioral/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment updated successfully',
        color: successColor,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to update assessment',
        color: errorColor,
      });
    },
  });
}
