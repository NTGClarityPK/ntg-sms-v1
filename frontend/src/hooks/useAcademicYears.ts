import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { AcademicYear } from '@/types/settings';

const academicYearsKeys = {
  all: ['academicYears'] as const,
  list: (params: { page: number; limit: number; search: string }) =>
    [...academicYearsKeys.all, 'list', params] as const,
  active: () => [...academicYearsKeys.all, 'active'] as const,
};

export function useAcademicYearsList(
  params?: Partial<{ page: number; limit: number; search: string }>,
  options?: { enabled?: boolean },
) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const search = params?.search ?? '';

  return useQuery({
    queryKey: academicYearsKeys.list({ page, limit, search }),
    queryFn: async () => {
      const res = await apiClient.get<AcademicYear[]>('/api/v1/academic-years', {
        params: { page, limit, search: search || undefined, sortBy: 'created_at', sortOrder: 'desc' },
      });
      return res;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useActiveAcademicYear(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: academicYearsKeys.active(),
    queryFn: async () => {
      const res = await apiClient.get<AcademicYear | null>('/api/v1/academic-years/active');
      return res;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; startDate: string; endDate: string }) => {
      const res = await apiClient.post<AcademicYear>('/api/v1/academic-years', payload);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: academicYearsKeys.all });
    },
  });
}

export function useActivateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<AcademicYear>(`/api/v1/academic-years/${id}/activate`);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: academicYearsKeys.all });
    },
  });
}

export function useLockAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<AcademicYear>(`/api/v1/academic-years/${id}/lock`);
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: academicYearsKeys.all });
    },
  });
}

export function useRolloverAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      sourceAcademicYearId: string;
      targetAcademicYearId: string;
      carryForward?: {
        classSections?: boolean;
        teacherAssignments?: boolean;
        timetableSlots?: boolean;
        leaveSettings?: boolean;
      };
    }) => {
      const res = await apiClient.post<{
        classSectionsCopied: number;
        teacherAssignmentsCopied: number;
        timetableSlotsCopied: number;
        leaveSettingsCopied: number;
      }>(`/api/v1/academic-years/${payload.sourceAcademicYearId}/rollover`, {
        targetAcademicYearId: payload.targetAcademicYearId,
        carryForward: payload.carryForward,
      });
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: academicYearsKeys.all });
    },
  });
}

// Type helper (keeps hooks strongly typed)
export type AcademicYearsListResponse = ApiResponse<AcademicYear[]>;

// Alias for backward compatibility
export const useAcademicYears = useAcademicYearsList;

