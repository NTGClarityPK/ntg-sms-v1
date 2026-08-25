'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ClassSectionResults,
  MarksReadinessRow,
  ResultCard,
  ResultReportSettings,
} from '@/types/results';
import { useAuth } from './useAuth';

/** GET result cards for a student (no meta). Parents get only published when enforced by backend. */
export function useResultCardsByStudent(
  studentId: string | null,
  options?: {
    academicYearId?: string;
    resultType?: string;
    publishedOnly?: boolean;
    reportKind?: string;
  },
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: [
      'results',
      'student-cards',
      studentId,
      options?.academicYearId,
      options?.resultType,
      options?.publishedOnly,
      options?.reportKind,
      branchId,
    ],
    queryFn: async (): Promise<ResultCard[]> => {
      if (!studentId || !branchId) return [];
      const params = new URLSearchParams();
      if (options?.academicYearId) params.set('academicYearId', options.academicYearId);
      if (options?.resultType) params.set('resultType', options.resultType);
      if (options?.reportKind) params.set('reportKind', options.reportKind);
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
  progressMonth?: number | null,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const type = resultType === 'interim' || resultType === 'mid_term' || resultType === 'final' ? resultType : 'final';

  return useQuery({
    queryKey: [
      'results',
      'class-section',
      classSectionId,
      academicYearId,
      type,
      progressMonth ?? null,
      branchId,
    ],
    queryFn: async (): Promise<ClassSectionResults | null> => {
      if (!classSectionId || !branchId) return null;
      const params = new URLSearchParams();
      params.set('resultType', type);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (progressMonth != null && progressMonth >= 1 && progressMonth <= 12) {
        params.set('progressMonth', String(progressMonth));
      }
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
  reportKind: string = 'term_report',
  progressSequence?: number | null,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const type = resultType === 'interim' || resultType === 'mid_term' || resultType === 'final' ? resultType : 'final';

  return useQuery({
    queryKey: [
      'results',
      'class-section-cards',
      classSectionId,
      academicYearId,
      type,
      reportKind,
      progressSequence ?? null,
      branchId,
    ],
    queryFn: async (): Promise<ResultCard[]> => {
      if (!classSectionId || !academicYearId || !branchId) return [];
      const params = new URLSearchParams();
      params.set('academicYearId', academicYearId);
      params.set('resultType', type);
      params.set('reportKind', reportKind);
      if (
        reportKind === 'progress_report' &&
        progressSequence != null &&
        progressSequence >= 1 &&
        progressSequence <= 12
      ) {
        params.set('progressSequence', String(progressSequence));
      }
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
      resultType?: string;
      reportKind?: string;
      progressSequence?: number;
    }) => {
      const body: Record<string, unknown> = {
        studentId: input.studentId,
        classSectionId: input.classSectionId,
      };
      if (input.academicYearId) body.academicYearId = input.academicYearId;
      if (input.reportKind) body.reportKind = input.reportKind;
      if (input.progressSequence != null) body.progressSequence = input.progressSequence;
      if (input.resultType) body.resultType = input.resultType;
      const response = await apiClient.post<ResultCard>('/api/v1/results/generate', body);
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

/** PATCH result card status (publish / unpublish → draft). */
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

/** GET marks readiness (phase exam assessments vs recorded grades). */
export function useClassSectionMarksReadiness(
  classSectionId: string | null,
  academicYearId: string | undefined,
  resultType: string,
  enabled: boolean,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const type = resultType === 'interim' || resultType === 'mid_term' || resultType === 'final' ? resultType : 'final';

  return useQuery({
    queryKey: ['results', 'marks-readiness', classSectionId, academicYearId, type, branchId],
    queryFn: async (): Promise<MarksReadinessRow[]> => {
      if (!classSectionId || !branchId) return [];
      const params = new URLSearchParams();
      params.set('resultType', type);
      if (academicYearId) params.set('academicYearId', academicYearId);
      const response = await apiClient.get<MarksReadinessRow[]>(
        `/api/v1/results/class-section/${classSectionId}/marks-readiness?${params.toString()}`,
      );
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: enabled && !!classSectionId && !!branchId,
    staleTime: 60 * 1000,
  });
}

/** GET branch result report PDF settings (admin / principal). */
export function useResultReportSettings(enabled: boolean) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['results', 'report-settings', branchId],
    queryFn: async (): Promise<ResultReportSettings | null> => {
      if (!branchId) return null;
      const response = await apiClient.get<ResultReportSettings>(
        '/api/v1/results/report-settings',
      );
      return response.data ?? null;
    },
    enabled: !!branchId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertResultReportSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pdfVariant?: 'minimal' | 'modern';
    }) => {
      const response = await apiClient.put<ResultReportSettings>(
        '/api/v1/results/report-settings',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['results', 'report-settings'] });
    },
  });
}
