import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { PromotionStudent, SavePromotionDecisionsInput, YearCloseReadiness } from '@/types/promotion-placement';

export type PromotionWindowStatus = {
  enabled: boolean;
  open: boolean;
  opensOn: string | null;
  manualOverride: boolean;
};

const keys = {
  all: ['promotionPlacement'] as const,
  students: (branchId: string | null, academicYearId: string | null, classSectionId: string | null) =>
    [...keys.all, 'students', branchId, academicYearId, classSectionId] as const,
  readiness: (branchId: string | null, academicYearId: string | null) =>
    [...keys.all, 'readiness', branchId, academicYearId] as const,
  window: (branchId: string | null, academicYearId: string | null) =>
    [...keys.all, 'window', branchId, academicYearId] as const,
};

export function usePromotionStudents(params: { academicYearId: string | null; classSectionId: string | null }) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id ?? null;

  return useQuery({
    queryKey: keys.students(branchId, params.academicYearId, params.classSectionId),
    queryFn: async () => {
      if (!branchId || !params.academicYearId) return { data: [] as PromotionStudent[] };
      const res = await apiClient.get<PromotionStudent[]>('/api/v1/promotion-placement/students', {
        params: {
          academicYearId: params.academicYearId,
          classSectionId: params.classSectionId || undefined,
        },
      });
      return res;
    },
    enabled: !!branchId && !!params.academicYearId,
    staleTime: 30 * 1000,
  });
}

export function useSavePromotionDecisions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id ?? null;

  return useMutation({
    mutationFn: async (payload: SavePromotionDecisionsInput & { classSectionId?: string | null }) => {
      const res = await apiClient.post<{ upserted: number }>('/api/v1/promotion-placement/decisions', payload);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.all });
    },
    meta: { branchId },
  });
}

export function usePromotionWindow(academicYearId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id ?? null;

  return useQuery({
    queryKey: keys.window(branchId, academicYearId),
    queryFn: async () => {
      const res = await apiClient.get<PromotionWindowStatus>('/api/v1/promotion-placement/window', {
        params: academicYearId ? { academicYearId } : undefined,
      });
      return res;
    },
    enabled: !!branchId,
    staleTime: 30 * 1000,
  });
}

export function useYearCloseReadiness(academicYearId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id ?? null;

  return useQuery({
    queryKey: keys.readiness(branchId, academicYearId),
    queryFn: async () => {
      if (!academicYearId) return null;
      const res = await apiClient.get<YearCloseReadiness>(`/api/v1/academic-years/${academicYearId}/readiness`);
      return res;
    },
    enabled: !!academicYearId && !!branchId,
    staleTime: 10 * 1000,
  });
}

