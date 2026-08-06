'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import type {
  BranchBehavioralConfig,
  ClassFrameworkReport,
  CombinedBehavioralHistory,
  CreateBlankFrameworkPresetInput,
  CreateFrameworkCategoryInput,
  CreateFrameworkRatingInput,
  FrameworkCategory,
  FrameworkPreset,
  FrameworkRating,
  UpdateBranchBehavioralConfigInput,
  UpdateFrameworkCategoryInput,
  UpdateFrameworkPresetInput,
  UpdateFrameworkRatingInput,
} from '@/types/behavioral-framework';

function useBranchId(): string | undefined {
  const { user } = useAuth();
  return user?.currentBranch?.id;
}

export function useBehavioralFrameworkConfig() {
  const branchId = useBranchId();

  return useQuery({
    queryKey: ['behavioral-framework', 'config', branchId],
    queryFn: async (): Promise<BranchBehavioralConfig | null> => {
      if (!branchId) return null;
      const response = await apiClient.get<BranchBehavioralConfig>(
        '/api/v1/behavioral-framework/config',
      );
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 30 * 1000,
  });
}

export function useUpdateBehavioralFrameworkConfig() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (input: UpdateBranchBehavioralConfigInput) => {
      const response = await apiClient.put<BranchBehavioralConfig>(
        '/api/v1/behavioral-framework/config',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkSystemSwitched'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkConfigError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useFrameworkPresets() {
  const branchId = useBranchId();

  return useQuery({
    queryKey: ['behavioral-framework', 'presets', branchId],
    queryFn: async (): Promise<FrameworkPreset[]> => {
      if (!branchId) return [];
      const response = await apiClient.get<FrameworkPreset[]>(
        '/api/v1/behavioral-framework/presets',
      );
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCloneFrameworkPreset() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (presetCode: string) => {
      const response = await apiClient.post<FrameworkPreset>(
        `/api/v1/behavioral-framework/presets/from-global/${encodeURIComponent(presetCode)}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkPresetCloned'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkPresetError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useCreateBlankFrameworkPreset() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (input: CreateBlankFrameworkPresetInput) => {
      const response = await apiClient.post<FrameworkPreset>(
        '/api/v1/behavioral-framework/presets',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkPresetCreated'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkPresetError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useUpdateFrameworkPreset() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateFrameworkPresetInput;
      silent?: boolean;
    }) => {
      const response = await apiClient.put<FrameworkPreset>(
        `/api/v1/behavioral-framework/presets/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      if (variables.silent) return;
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkPresetSaved'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkPresetError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useDeleteFrameworkPreset() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ id: string }>(
        `/api/v1/behavioral-framework/presets/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkPresetDeleted'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkPresetError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useAddFrameworkCategory() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async ({
      presetId,
      input,
    }: {
      presetId: string;
      input: CreateFrameworkCategoryInput;
      silent?: boolean;
    }) => {
      const response = await apiClient.post<FrameworkCategory>(
        `/api/v1/behavioral-framework/presets/${presetId}/categories`,
        input,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      if (variables.silent) return;
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkCategorySaved'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkCategoryError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useUpdateFrameworkCategory() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateFrameworkCategoryInput;
      silent?: boolean;
    }) => {
      const response = await apiClient.put<FrameworkCategory>(
        `/api/v1/behavioral-framework/categories/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      if (variables.silent) return;
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkCategorySaved'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkCategoryError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useDeleteFrameworkCategory() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ id: string }>(
        `/api/v1/behavioral-framework/categories/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'presets', branchId] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'config', branchId] });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorFrameworkCategoryDeleted'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || tSettings('behaviorFrameworkCategoryError'),
        color: notifyColors.error,
      });
    },
  });
}

function invalidateFrameworkTeacherQueries(queryClient: ReturnType<typeof useQueryClient>, branchId?: string) {
  queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'class-report', branchId] });
  queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'history', branchId] });
  queryClient.invalidateQueries({ queryKey: ['behavioral-framework', 'ratings', branchId] });
}

export function useFrameworkClassReport(
  classSectionId: string | null,
  month?: string,
) {
  const branchId = useBranchId();

  return useQuery({
    queryKey: ['behavioral-framework', 'class-report', branchId, classSectionId, month],
    queryFn: async (): Promise<ClassFrameworkReport | null> => {
      if (!branchId || !classSectionId) return null;
      const params = month ? `?month=${encodeURIComponent(month)}` : '';
      const response = await apiClient.get<ClassFrameworkReport>(
        `/api/v1/behavioral-framework/reports/class/${classSectionId}${params}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!classSectionId,
    staleTime: 1 * 60 * 1000,
  });
}

export function useCombinedBehavioralHistory(
  studentId: string | null,
  academicYearId?: string,
) {
  const branchId = useBranchId();

  return useQuery({
    queryKey: ['behavioral-framework', 'history', branchId, studentId, academicYearId],
    queryFn: async (): Promise<CombinedBehavioralHistory | null> => {
      if (!branchId || !studentId) return null;
      const params = academicYearId
        ? `?academicYearId=${encodeURIComponent(academicYearId)}`
        : '';
      const response = await apiClient.get<CombinedBehavioralHistory>(
        `/api/v1/behavioral-framework/reports/student/${studentId}${params}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!studentId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFrameworkRatingsForStudent(
  studentId: string | null,
  academicYearId?: string,
) {
  const branchId = useBranchId();

  return useQuery({
    queryKey: ['behavioral-framework', 'ratings', branchId, studentId, academicYearId],
    queryFn: async (): Promise<FrameworkRating[]> => {
      if (!branchId || !studentId) return [];
      const params = academicYearId
        ? `?academicYearId=${encodeURIComponent(academicYearId)}`
        : '';
      const response = await apiClient.get<FrameworkRating[]>(
        `/api/v1/behavioral-framework/ratings/student/${studentId}${params}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!studentId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateFrameworkRating() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const t = useTranslations('behavioral');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (input: CreateFrameworkRatingInput) => {
      const response = await apiClient.post<FrameworkRating>(
        '/api/v1/behavioral-framework/ratings',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateFrameworkTeacherQueries(queryClient, branchId);
      notifications.show({
        title: tCommon('success'),
        message: t('frameworkRatingSaved'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || t('frameworkRatingError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useUpdateFrameworkRating() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const t = useTranslations('behavioral');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateFrameworkRatingInput;
    }) => {
      const response = await apiClient.put<FrameworkRating>(
        `/api/v1/behavioral-framework/ratings/${id}`,
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateFrameworkTeacherQueries(queryClient, branchId);
      notifications.show({
        title: tCommon('success'),
        message: t('frameworkRatingSaved'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || t('frameworkRatingError'),
        color: notifyColors.error,
      });
    },
  });
}

export function useDeleteFrameworkRating() {
  const queryClient = useQueryClient();
  const branchId = useBranchId();
  const t = useTranslations('behavioral');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ id: string }>(
        `/api/v1/behavioral-framework/ratings/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      invalidateFrameworkTeacherQueries(queryClient, branchId);
      notifications.show({
        title: tCommon('success'),
        message: t('frameworkRatingDeleted'),
        color: notifyColors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: tCommon('error'),
        message: error.message || t('frameworkRatingError'),
        color: notifyColors.error,
      });
    },
  });
}
