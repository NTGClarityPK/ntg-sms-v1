'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ClassSectionResults, ResultCard } from '@/types/results';
import { useAuth } from './useAuth';

/** GET result cards for a student (no meta). Parents get only published when enforced by backend. */
export function useResultCardsByStudent(
  studentId: string | null,
  options?: { academicYearId?: string; resultType?: string; publishedOnly?: boolean },
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['results', 'student-cards', studentId, options?.academicYearId, options?.resultType, options?.publishedOnly, branchId],
    queryFn: async (): Promise<ResultCard[]> => {
      if (!studentId || !branchId) return [];
      const params = new URLSearchParams();
      if (options?.academicYearId) params.set('academicYearId', options.academicYearId);
      if (options?.resultType) params.set('resultType', options.resultType);
      if (options?.publishedOnly === true) params.set('publishedOnly', 'true');
      const response = await apiClient.get<ResultCard[]>(
        `/api/v1/results/student/${studentId}/cards?${params.toString()}`,
      );
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/** GET class-section results (no meta) → return response.data. */
export function useClassSectionResults(
  classSectionId: string | null,
  academicYearId: string | undefined,
  resultType: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const type = resultType === 'interim' || resultType === 'mid_term' || resultType === 'final' ? resultType : 'final';

  return useQuery({
    queryKey: ['results', 'class-section', classSectionId, academicYearId, type, branchId],
    queryFn: async (): Promise<ClassSectionResults | null> => {
      if (!classSectionId || !branchId) return null;
      const params = new URLSearchParams();
      params.set('resultType', type);
      if (academicYearId) params.set('academicYearId', academicYearId);
      const response = await apiClient.get<ClassSectionResults>(
        `/api/v1/results/class-section/${classSectionId}?${params.toString()}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/** GET result cards for a class section (no meta). For publish UI. */
export function useResultCardsByClassSection(
  classSectionId: string | null,
  academicYearId: string | undefined,
  resultType: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const type = resultType === 'interim' || resultType === 'mid_term' || resultType === 'final' ? resultType : 'final';

  return useQuery({
    queryKey: ['results', 'class-section-cards', classSectionId, academicYearId, type, branchId],
    queryFn: async (): Promise<ResultCard[]> => {
      if (!classSectionId || !academicYearId || !branchId) return [];
      const params = new URLSearchParams();
      params.set('academicYearId', academicYearId);
      params.set('resultType', type);
      const response = await apiClient.get<ResultCard[]>(
        `/api/v1/results/class-section/${classSectionId}/cards?${params.toString()}`,
      );
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!classSectionId && !!academicYearId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/** POST generate result card (draft). */
export function useGenerateResultCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentId: string;
      classSectionId: string;
      academicYearId?: string;
      resultType: string;
    }) => {
      const response = await apiClient.post<ResultCard>('/api/v1/results/generate', input);
      return response.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

/** PATCH result card comment (class teacher). */
export function useUpdateResultCardComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, classTeacherComment }: { id: string; classTeacherComment?: string }) => {
      const response = await apiClient.patch<ResultCard>(
        `/api/v1/results/${id}/comment`,
        { classTeacherComment },
      );
      return response.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

/** PATCH result card status (e.g. publish). */
export function useUpdateResultCardStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiClient.patch<ResultCard>(`/api/v1/results/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['results'] });
    },
  });
}
