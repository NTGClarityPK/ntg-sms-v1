import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PublicHoliday, TimingTemplate, Vacation } from '@/types/settings';

function currentBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentBranchId');
}

const scheduleKeys = {
  schoolDays: (branchId: string | null) => ['schedule', 'schoolDays', branchId] as const,
  timingTemplates: (branchId: string | null) => ['schedule', 'timingTemplates', branchId] as const,
  holidays: (academicYearId: string) => ['schedule', 'holidays', academicYearId] as const,
  vacations: (academicYearId: string) => ['schedule', 'vacations', academicYearId] as const,
};

export function useSchoolDays() {
  const branchId = currentBranchId();
  return useQuery({
    queryKey: scheduleKeys.schoolDays(branchId),
    queryFn: async () => apiClient.get<number[]>('/api/v1/settings/school-days'),
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSchoolDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activeDays: number[]) =>
      apiClient.put<number[]>('/api/v1/settings/school-days', { activeDays }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['schedule', 'schoolDays'] });
    },
  });
}

export function useTimingTemplates() {
  const branchId = currentBranchId();
  return useQuery({
    queryKey: scheduleKeys.timingTemplates(branchId),
    queryFn: async () =>
      apiClient.get<TimingTemplate[]>('/api/v1/timing-templates', { params: { page: 1, limit: 100 } }),
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTimingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      startTime: string;
      endTime: string;
      periodDurationMinutes?: number;
      slots?: Array<{ name: string; startTime?: string; endTime?: string; sortOrder?: number }>;
    }) => apiClient.post<TimingTemplate>('/api/v1/timing-templates', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['schedule', 'timingTemplates'] });
    },
  });
}

export function useAssignClassesToTimingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { templateId: string; classIds: string[] }) =>
      apiClient.put<string[]>(`/api/v1/timing-templates/${payload.templateId}/assign-classes`, { classIds: payload.classIds }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['schedule', 'timingTemplates'] });
    },
  });
}

export function usePublicHolidays(academicYearId?: string) {
  return useQuery({
    queryKey: academicYearId ? scheduleKeys.holidays(academicYearId) : ['schedule', 'holidays', 'none'],
    enabled: Boolean(academicYearId),
    queryFn: async () =>
      apiClient.get<PublicHoliday[]>('/api/v1/public-holidays', { params: { academicYearId } }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; startDate: string; endDate: string; academicYearId: string; nameAr?: string }) =>
      apiClient.post<PublicHoliday>('/api/v1/public-holidays', payload),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.holidays(vars.academicYearId) });
    },
  });
}

export function useUpdatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; academicYearId: string; name?: string; startDate?: string; endDate?: string }) => {
      const { id, academicYearId, ...body } = payload;
      return apiClient.put<PublicHoliday>(`/api/v1/public-holidays/${id}`, body);
    },
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.holidays(vars.academicYearId) });
    },
  });
}

export function useDeletePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; academicYearId: string }) =>
      apiClient.delete<{ id: string }>(`/api/v1/public-holidays/${payload.id}`),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.holidays(vars.academicYearId) });
    },
  });
}

export function useVacations(academicYearId?: string) {
  return useQuery({
    queryKey: academicYearId ? scheduleKeys.vacations(academicYearId) : ['schedule', 'vacations', 'none'],
    enabled: Boolean(academicYearId),
    queryFn: async () =>
      apiClient.get<Vacation[]>('/api/v1/vacations', { params: { academicYearId } }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      nameAr?: string;
      startDate: string;
      endDate: string;
      academicYearId: string;
    }) => apiClient.post<Vacation>('/api/v1/vacations', payload),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.vacations(vars.academicYearId) });
    },
  });
}

export function useUpdateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, academicYearId, ...payload }: { id: string; academicYearId: string } & Partial<{
      name: string;
      nameAr?: string;
      startDate: string;
      endDate: string;
    }>) => apiClient.put<Vacation>(`/api/v1/vacations/${id}`, payload),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({
        queryKey: scheduleKeys.vacations(vars.academicYearId),
      });
    },
  });
}

export function useDeleteVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, academicYearId }: { id: string; academicYearId: string }) =>
      apiClient.delete<{ id: string }>(`/api/v1/vacations/${id}`),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.vacations(vars.academicYearId) });
    },
  });
}


