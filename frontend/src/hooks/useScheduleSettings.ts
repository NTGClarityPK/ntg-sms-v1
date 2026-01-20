import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PublicHoliday, TimingTemplate } from '@/types/settings';

const scheduleKeys = {
  schoolDays: ['schedule', 'schoolDays'] as const,
  timingTemplates: ['schedule', 'timingTemplates'] as const,
  holidays: (academicYearId: string) => ['schedule', 'holidays', academicYearId] as const,
};

export function useSchoolDays() {
  return useQuery({
    queryKey: scheduleKeys.schoolDays,
    queryFn: async () => apiClient.get<number[]>('/api/v1/settings/school-days'),
  });
}

export function useUpdateSchoolDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activeDays: number[]) =>
      apiClient.put<number[]>('/api/v1/settings/school-days', { activeDays }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.schoolDays });
    },
  });
}

export function useTimingTemplates() {
  return useQuery({
    queryKey: scheduleKeys.timingTemplates,
    queryFn: async () =>
      apiClient.get<TimingTemplate[]>('/api/v1/timing-templates', { params: { page: 1, limit: 100 } }),
  });
}

export function useCreateTimingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      startTime: string;
      endTime: string;
      assemblyStart?: string;
      assemblyEnd?: string;
      breakStart?: string;
      breakEnd?: string;
      periodDurationMinutes?: number;
    }) => apiClient.post<TimingTemplate>('/api/v1/timing-templates', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.timingTemplates });
    },
  });
}

export function useAssignClassesToTimingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { templateId: string; classIds: string[] }) =>
      apiClient.put<string[]>(`/api/v1/timing-templates/${payload.templateId}/assign-classes`, { classIds: payload.classIds }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: scheduleKeys.timingTemplates });
    },
  });
}

export function usePublicHolidays(academicYearId?: string) {
  return useQuery({
    queryKey: academicYearId ? scheduleKeys.holidays(academicYearId) : ['schedule', 'holidays', 'none'],
    enabled: Boolean(academicYearId),
    queryFn: async () =>
      apiClient.get<PublicHoliday[]>('/api/v1/public-holidays', { params: { academicYearId } }),
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


