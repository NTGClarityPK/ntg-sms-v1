'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Certificate,
  CertificateDesign,
  CertificateIssueFormDefaults,
  CertificateSettings,
  CertificateStatus,
  CertificateType,
  GeneratePreviewInput,
  IssueCertificateInput,
} from '@/types/certificates';
import { notifications } from '@mantine/notifications';
import { parseApiErrorMessage } from '@/lib/parse-api-error';

function branchKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('currentBranchId');
}

export function useCertificateDesigns() {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['certificates', 'designs', branchId],
    queryFn: async () => {
      const res = await apiClient.get<CertificateDesign[]>('/api/v1/certificates/designs');
      return res.data;
    },
    enabled: !!branchId,
    staleTime: 120_000,
  });
}

export function useCertificateSettings() {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['certificates', 'settings', branchId],
    queryFn: async () => {
      const res = await apiClient.get<CertificateSettings>('/api/v1/certificates/settings');
      return res.data;
    },
    enabled: !!branchId,
    staleTime: 60_000,
  });
}

export function useUpdateCertificateSettings() {
  const qc = useQueryClient();
  const branchId = branchKey();
  return useMutation({
    mutationFn: async (input: Partial<CertificateSettings>) => {
      const res = await apiClient.put<CertificateSettings>(
        '/api/v1/certificates/settings',
        input,
      );
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['certificates', 'settings', branchId] });
      notifications.show({ title: 'Settings saved', message: '', color: 'green' });
    },
  });
}

export function useUploadCertificateLogo() {
  const qc = useQueryClient();
  const branchId = branchKey();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<{ schoolLogoUrl: string }>(
        '/api/v1/certificates/settings/logo',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['certificates', 'settings', branchId] });
    },
  });
}

export function useCertificateHistory(params: {
  page?: number;
  limit?: number;
  type?: CertificateType;
  studentId?: string;
  classSectionId?: string;
  status?: CertificateStatus;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  mine?: boolean;
}) {
  const branchId = branchKey();
  const base = params.mine ? '/api/v1/my-certificates' : '/api/v1/certificates/history';
  return useQuery({
    queryKey: ['certificates', 'history', branchId, params],
    queryFn: async () => {
      return apiClient.get<Certificate[]>(base, {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          type: params.type,
          studentId: params.studentId,
          classSectionId: params.classSectionId,
          status: params.status,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      });
    },
    enabled: !!branchId && params.enabled !== false,
    staleTime: 30_000,
  });
}

export function useCertificateIssueFormDefaults(
  studentId: string | null,
  certificateType: CertificateType | null,
) {
  const branchId = branchKey();
  return useQuery({
    queryKey: ['certificates', 'issue-defaults', branchId, studentId, certificateType],
    queryFn: async () => {
      const res = await apiClient.get<CertificateIssueFormDefaults>(
        '/api/v1/certificates/issue-form-defaults',
        {
          params: { studentId, certificateType },
        },
      );
      return res.data;
    },
    enabled: !!branchId && !!studentId && !!certificateType,
    staleTime: 30_000,
  });
}

export function useGenerateCertificatePreview() {
  return useMutation({
    mutationFn: async (input: GeneratePreviewInput) => {
      const res = await apiClient.post<{ html: string }>(
        '/api/v1/certificates/generate-preview',
        input,
        { suppressErrorNotification: true },
      );
      const payload = res.data;
      if (typeof payload === 'string') return payload;
      if (payload && typeof payload === 'object' && 'html' in payload) {
        const html = (payload as { html?: string }).html;
        return typeof html === 'string' ? html : '';
      }
      return '';
    },
  });
}

export function useIssueCertificate() {
  const qc = useQueryClient();
  const branchId = branchKey();
  return useMutation({
    mutationFn: async (input: IssueCertificateInput) => {
      const res = await apiClient.post<Certificate>('/api/v1/certificates/issue', input);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['certificates'] });
      notifications.show({
        title: 'Certificate issued',
        message: '',
        color: 'green',
      });
    },
    onError: async (err) => {
      const { message } = await parseApiErrorMessage(err);
      notifications.show({
        title: 'Could not issue certificate',
        message: message ?? 'Please check the form and try again.',
        color: 'red',
      });
    },
  });
}

export function useRevokeCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.put<Certificate>(`/api/v1/certificates/${id}/revoke`, {});
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['certificates'] });
      notifications.show({ title: 'Certificate revoked', message: '', color: 'orange' });
    },
  });
}

export async function downloadCertificatePdf(id: string, mine = false): Promise<void> {
  const base = mine ? `/api/v1/my-certificates/${id}/pdf` : `/api/v1/certificates/${id}/pdf`;
  const blob = await apiClient.getBlob(base);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `certificate-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportCertificateHistoryCsv(params: Record<string, string | undefined>) {
  const blob = await apiClient.getBlob('/api/v1/certificates/history/export', { params });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'certificate-history.csv';
  a.click();
  URL.revokeObjectURL(url);
}
