import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AssessmentType, ClassGradeAssignment, GradeTemplate } from '@/types/settings';

const assessmentKeys = {
  types: ['assessment', 'types'] as const,
  templates: ['assessment', 'templates'] as const,
  assignments: ['assessment', 'assignments'] as const,
  leaveQuota: (academicYearId: string) => ['assessment', 'leaveQuota', academicYearId] as const,
};

export function useAssessmentTypes() {
  return useQuery({
    queryKey: assessmentKeys.types,
    queryFn: async () =>
      apiClient.get<AssessmentType[]>('/api/v1/assessment-types', { params: { page: 1, limit: 100 } }),
  });
}

export function useCreateAssessmentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; nameAr?: string; sortOrder?: number; isActive?: boolean }) =>
      apiClient.post<AssessmentType>('/api/v1/assessment-types', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assessmentKeys.types });
    },
  });
}

export function useGradeTemplates() {
  return useQuery({
    queryKey: assessmentKeys.templates,
    queryFn: async () => apiClient.get<GradeTemplate[]>('/api/v1/grade-templates'),
  });
}

export function useCreateGradeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      ranges: Array<{ letter: string; minPercentage: number; maxPercentage: number; sortOrder?: number }>;
    }) => apiClient.post<GradeTemplate>('/api/v1/grade-templates', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assessmentKeys.templates });
    },
  });
}

export function useUpdateGradeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      ranges?: Array<{ letter: string; minPercentage: number; maxPercentage: number; sortOrder?: number }>;
    }) => {
      const { id, ...body } = payload;
      return apiClient.put<GradeTemplate>(`/api/v1/grade-templates/${id}`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assessmentKeys.templates });
    },
  });
}

export function useDeleteGradeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete<{ id: string }>(`/api/v1/grade-templates/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assessmentKeys.templates });
    },
  });
}

export function useAssignGradeTemplateToClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { gradeTemplateId: string; classId: string; minimumPassingGrade: string }) =>
      apiClient.put<unknown>(`/api/v1/grade-templates/${payload.gradeTemplateId}/assign-classes`, {
        classId: payload.classId,
        minimumPassingGrade: payload.minimumPassingGrade,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assessmentKeys.assignments });
    },
  });
}

export function useClassGradeAssignments() {
  return useQuery({
    queryKey: assessmentKeys.assignments,
    queryFn: async () => apiClient.get<ClassGradeAssignment[]>('/api/v1/grade-templates/assignments'),
  });
}

export function useLeaveQuota(academicYearId?: string) {
  return useQuery({
    queryKey: academicYearId ? assessmentKeys.leaveQuota(academicYearId) : ['assessment', 'leaveQuota', 'none'],
    enabled: Boolean(academicYearId),
    queryFn: async () => apiClient.get<{ academicYearId: string; annualQuota: number }>('/api/v1/settings/leave-quota', { params: { academicYearId } }),
  });
}

export function useSetLeaveQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { academicYearId: string; annualQuota: number }) =>
      apiClient.put<{ academicYearId: string; annualQuota: number }>('/api/v1/settings/leave-quota', payload),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: assessmentKeys.leaveQuota(vars.academicYearId) });
    },
  });
}


