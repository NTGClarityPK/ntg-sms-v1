'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  IdCard,
  IdCardAnalytics,
  IdCardDesignVariant,
  IdCardGenerationJob,
  IdCardClassSectionRecipientsMeta,
  IdCardStudentRecipient,
  IdCardPersonType,
  IdCardRenderData,
  IdCardStats,
  IdCardStatus,
  IdCardTemplate,
} from '@/types/id-cards';
import { notifications } from '@mantine/notifications';

function branchKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentBranchId');
}

export function useIdCardStats() {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'stats', branchId],
    queryFn: async () => {
      const res = await apiClient.get<IdCardStats>('/api/v1/id-cards/stats');
      return res.data;
    },
    enabled: !!branchId,
    staleTime: 60_000,
  });
}

export function useIdCardAnalytics() {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'analytics', branchId],
    queryFn: async () => {
      const res = await apiClient.get<IdCardAnalytics>('/api/v1/id-cards/analytics');
      return res.data;
    },
    enabled: !!branchId,
    staleTime: 60_000,
  });
}

export function useIdCards(params: {
  personType?: IdCardPersonType;
  status?: IdCardStatus;
  classSectionId?: string;
  page?: number;
  limit?: number;
  search?: string;
  missingPhotoOnly?: boolean;
  enabled?: boolean;
}) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'list', branchId, params],
    queryFn: async () => {
      const response = await apiClient.get<IdCard[]>('/api/v1/id-cards', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 24,
          personType: params.personType,
          status: params.status,
          classSectionId: params.classSectionId,
          search: params.search,
          missingPhotoOnly: params.missingPhotoOnly ? 'true' : undefined,
        },
      });
      return response;
    },
    enabled: !!branchId && (params.enabled !== false),
    staleTime: 30_000,
  });
}

export function useIdCard(id: string | undefined) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', id, branchId],
    queryFn: async () => {
      const res = await apiClient.get<IdCard>(`/api/v1/id-cards/${id}`);
      return res.data;
    },
    enabled: !!branchId && !!id,
  });
}

export function useIdCardTemplates(roleType?: IdCardPersonType) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'templates', branchId, roleType],
    queryFn: async () => {
      const res = await apiClient.get<IdCardTemplate[]>('/api/v1/id-cards/templates', {
        params: roleType ? { roleType } : undefined,
      });
      return res.data;
    },
    enabled: !!branchId,
  });
}

export function useIdCardClassSectionRecipients(classSectionId: string | null, enabled: boolean) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'class-section-recipients', branchId, classSectionId],
    queryFn: async () => {
      const res = await apiClient.get<IdCardStudentRecipient[]>(
        `/api/v1/id-cards/class-section/${classSectionId}/student-recipients`,
      );
      const meta = res.meta as IdCardClassSectionRecipientsMeta | undefined;
      return {
        recipients: res.data ?? [],
        statusCounts: meta?.statusCounts ?? {},
      };
    },
    enabled: !!branchId && !!classSectionId && enabled,
    staleTime: 60_000,
  });
}

export function useIdCardDesignPreview(
  variant: IdCardDesignVariant,
  personType: IdCardPersonType = 'student',
  personId?: string,
  queryEnabled = true,
) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'design-preview', branchId, variant, personType, personId],
    queryFn: async () => {
      const res = await apiClient.get<{ html: string }>('/api/v1/id-cards/design-preview', {
        params: {
          variant,
          personType,
          personId: personId || undefined,
        },
      });
      return res.data?.html ?? '';
    },
    enabled: !!branchId && !!variant && queryEnabled,
    staleTime: 30_000,
  });
}

export function useIdCardPreviewData(personType: IdCardPersonType | undefined, personId: string | undefined) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'card-data', branchId, personType, personId],
    queryFn: async () => {
      const res = await apiClient.get<IdCardRenderData>(
        `/api/v1/id-cards/card-data/${personType}/${personId}`,
      );
      return res.data;
    },
    enabled: !!branchId && !!personType && !!personId,
  });
}

export function useGenerateIdCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      personType: IdCardPersonType;
      personIds?: string[];
      classSectionId?: string;
      staffRoleId?: string;
      templateId?: string;
      designVariant?: IdCardDesignVariant;
    }) => {
      const res = await apiClient.post<IdCard[]>('/api/v1/id-cards/generate', input);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['id-cards'] });
      notifications.show({ title: 'Success', message: 'ID cards generated', color: 'green' });
    },
  });
}

export function useEnqueueIdCardJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      personType: IdCardPersonType;
      personIds?: string[];
      classSectionId?: string;
      staffRoleId?: string;
      templateId?: string;
      designVariant?: IdCardDesignVariant;
    }) => {
      const res = await apiClient.post<{ jobId: string }>('/api/v1/id-cards/generation-jobs', input);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
  });
}

export function useIdCardGenerationJob(jobId: string | null) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['id-cards', 'job', jobId, branchId],
    queryFn: async () => {
      const res = await apiClient.get<IdCardGenerationJob>(`/api/v1/id-cards/generation-jobs/${jobId}`);
      return res.data;
    },
    enabled: !!branchId && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || ['completed', 'failed', 'cancelled'].includes(status)) return false;
      return 1500;
    },
  });
}

export function useUpdateIdCardStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { status: IdCardStatus; cardIds: string[] }) => {
      const res = await apiClient.patch<{ updated: number }>('/api/v1/id-cards/status', input);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
  });
}

export function useUploadIdCardPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      personType: IdCardPersonType;
      personId?: string;
      file: File;
      matchByFilename?: boolean;
    }) => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('personType', input.personType);
      if (input.personId) form.append('personId', input.personId);
      if (input.matchByFilename) form.append('matchKey', '1');
      const res = await apiClient.post<{ originalUrl: string; processedUrl: string }>(
        '/api/v1/id-cards/photos',
        form,
      );
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['id-cards'] });
      await qc.invalidateQueries({ queryKey: ['students'] });
      await qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useReprintIdCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cardId: string; reason: string; feeCharged?: number }) => {
      const res = await apiClient.post<IdCard>(
        `/api/v1/id-cards/${input.cardId}/reprint`,
        { reason: input.reason, feeCharged: input.feeCharged },
      );
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
  });
}

const PDF_DOWNLOAD_NOTIFICATION_ID = 'id-card-pdf-download';

export type IdCardPdfDownloadOptions = {
  side?: 'front' | 'back' | 'both';
  designVariant?: IdCardDesignVariant;
  messages?: { preparing: string; failed: string };
};

export async function downloadIdCardPdf(
  cardId: string,
  options: IdCardPdfDownloadOptions = {},
): Promise<void> {
  const { side = 'both', designVariant, messages } = options;
  notifications.show({
    id: PDF_DOWNLOAD_NOTIFICATION_ID,
    title: messages?.preparing ?? 'Preparing PDF…',
    message: messages?.preparing ?? 'Preparing PDF…',
    loading: true,
    autoClose: false,
  });
  try {
    const { blob, filename } = await apiClient.getBlobWithFilename(`/api/v1/id-cards/${cardId}/pdf`, {
      params: {
        side,
        designVariant,
        _: Date.now().toString(),
      },
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `id-card-${cardId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    notifications.hide(PDF_DOWNLOAD_NOTIFICATION_ID);
  } catch {
    notifications.update({
      id: PDF_DOWNLOAD_NOTIFICATION_ID,
      title: messages?.failed ?? 'Could not generate PDF',
      message: messages?.failed ?? 'Could not generate PDF',
      color: 'red',
      loading: false,
      autoClose: true,
    });
    throw new Error(messages?.failed ?? 'Could not generate PDF');
  }
}

export async function downloadBulkIdCardsZip(
  cardIds: string[],
  layout: 'single' | 'a4_9up' = 'single',
  options: { designVariant?: IdCardDesignVariant; messages?: { preparing: string; failed: string } } = {},
): Promise<void> {
  if (cardIds.length === 0) return;
  const { designVariant, messages } = options;
  notifications.show({
    id: PDF_DOWNLOAD_NOTIFICATION_ID,
    title: messages?.preparing ?? 'Preparing PDF…',
    message: messages?.preparing ?? 'Preparing PDF…',
    loading: true,
    autoClose: false,
  });
  try {
    const { blob, filename } = await apiClient.postBlobWithFilename('/api/v1/id-cards/bulk-pdf', {
      cardIds,
      layout,
      designVariant,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'id-cards.zip';
    a.click();
    URL.revokeObjectURL(url);
    notifications.hide(PDF_DOWNLOAD_NOTIFICATION_ID);
  } catch {
    notifications.update({
      id: PDF_DOWNLOAD_NOTIFICATION_ID,
      title: messages?.failed ?? 'Could not generate PDF',
      message: messages?.failed ?? 'Could not generate PDF',
      color: 'red',
      loading: false,
      autoClose: true,
    });
    throw new Error(messages?.failed ?? 'Could not generate PDF');
  }
}
