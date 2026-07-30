/**
 * React Query hooks for assessment rubrics and presets
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiClient } from '@/lib/api-client';
import type {
  AssessmentRubric,
  AssessmentRubricWithScores,
  CreateAssessmentRubricInput,
  CreateRubricPresetInput,
  RubricPreset,
  StudentRubricScore,
  UpdateAssessmentRubricInput,
  UpdateRubricPresetInput,
  UpsertStudentRubricScoresInput,
} from '@/types/rubrics';

export function useRubricPresets() {
  return useQuery({
    queryKey: ['rubrics', 'presets'],
    queryFn: async () => {
      const response = await apiClient.get<RubricPreset[]>('/api/v1/rubrics/presets');
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateRubricPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRubricPresetInput) => {
      const response = await apiClient.post<RubricPreset>('/api/v1/rubrics/presets', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'presets'] });
      notifications.show({
        title: 'Success',
        message: 'Rubric preset created',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create rubric preset',
        color: 'red',
      });
    },
  });
}

export function useUpdateRubricPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateRubricPresetInput }) => {
      const response = await apiClient.put<RubricPreset>(`/api/v1/rubrics/presets/${id}`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'presets'] });
      notifications.show({
        title: 'Success',
        message: 'Rubric preset saved',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save rubric preset',
        color: 'red',
      });
    },
  });
}

export function useAssessmentRubric(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ['rubrics', 'assessment', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<AssessmentRubricWithScores | null>(
        `/api/v1/assessments/${assessmentId}/rubric`,
      );
      return response.data;
    },
    enabled: !!assessmentId,
    staleTime: 1000 * 60,
  });
}

export function useCreateAssessmentRubric(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssessmentRubricInput) => {
      const response = await apiClient.post<AssessmentRubric>(
        `/api/v1/assessments/${assessmentId}/rubric`,
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'assessment', assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Rubric created',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create rubric',
        color: 'red',
      });
    },
  });
}

export function useUpdateAssessmentRubric(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAssessmentRubricInput) => {
      const response = await apiClient.put<AssessmentRubric>(
        `/api/v1/assessments/${assessmentId}/rubric`,
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'assessment', assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Rubric updated',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update rubric',
        color: 'red',
      });
    },
  });
}

export function useDeleteAssessmentRubric(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<null>(
        `/api/v1/assessments/${assessmentId}/rubric`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'assessment', assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Rubric removed',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to remove rubric',
        color: 'red',
      });
    },
  });
}

export function useUpsertStudentRubricScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentGradeId,
      input,
    }: {
      studentGradeId: string;
      input: UpsertStudentRubricScoresInput;
    }) => {
      const response = await apiClient.put<StudentRubricScore[]>(
        `/api/v1/student-grades/${studentGradeId}/rubric-scores`,
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      notifications.show({
        title: 'Success',
        message: 'Category scores saved',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save category scores',
        color: 'red',
      });
    },
  });
}
