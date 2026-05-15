import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  FeeChallanGenerateResult,
  FeeChallanPreviewRequest,
  FeeCalculationPreview,
  FeeStudentTemplatesResponse,
  FeeChallanSettings,
  FeeTemplate,
} from '@/types/fees';
import { notifications } from '@mantine/notifications';

export type FeeChallanGenerateJobStatus = {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  totalStudents: number;
  processedStudents: number;
  errorMessage: string | null;
  result: { data: FeeChallanGenerateResult[] } | null;
  createdAt: string;
  updatedAt: string;
};

export function useFeeTemplates(params: { scope?: string; type?: string; isActive?: string } = {}) {
  return useQuery({
    queryKey: ['fees', 'templates', params],
    queryFn: async () => {
      const response = await apiClient.get<FeeTemplate[]>('/api/v1/fees/templates', { params });
      return response.data; // no meta
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateFeeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      type: 'Fee' | 'Discount';
      scope: 'Levels' | 'Class' | 'Class-Section' | 'Individual';
      currencyCode?: 'PKR' | 'IQD' | 'SAR' | 'USD';
      autoApply?: boolean;
      autoApplyCondition?: Record<string, unknown> | null;
      daysUntilDue?: number;
      metrics: Array<{ name: string; amountType: 'Absolute' | 'Percentage'; amount: number; perDay?: boolean; displayOrder?: number }>;
    }) => {
      const response = await apiClient.post<ApiResponse<FeeTemplate>>('/api/v1/fees/templates', input);
      return response.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fees', 'templates'] });
      notifications.show({ title: 'Success', message: 'Template created', color: 'green' });
    },
  });
}

export function useDeleteFeeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete<ApiResponse<{ success: boolean }>>(`/api/v1/fees/templates/${id}`);
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fees', 'templates'] });
    },
  });
}

export function useFeeChallanSettings() {
  return useQuery({
    queryKey: ['fees', 'challan-settings'],
    queryFn: async () => {
      // apiClient.get<T>() already returns ApiResponse<T> (i.e. { data: T })
      const response = await apiClient.get<FeeChallanSettings>('/api/v1/fees/challan-settings');
      // React Query v5: queryFn must not return undefined
      return (
        response.data ?? {
          challanTemplate: 'Minimal',
          bankName: null,
          accountTitle: null,
          accountNumber: null,
          bankBranchCode: null,
          paymentInstructions: null,
          footerText: null,
        }
      );
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpsertFeeChallanSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeeChallanSettings) => {
      const response = await apiClient.put<FeeChallanSettings>('/api/v1/fees/challan-settings', input);
      return response.data ?? input;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fees', 'challan-settings'] });
    },
  });
}

export function useCreateFeeTemplateAssignment() {
  return useMutation({
    mutationFn: async (input: { templateId: string; scopeType: 'Level' | 'Class' | 'Section'; scopeId: string }) => {
      const response = await apiClient.post<{ id: string }>(`/api/v1/fees/templates/${input.templateId}/assignments`, {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
      });
      return response.data;
    },
  });
}

export function useGenerateFeeChallans() {
  return useMutation({
    mutationFn: async (input: {
      studentIds: string[];
      months: string[];
      autoCalculateDueDate?: boolean;
      dueDate?: string;
      billingStartDate?: string;
      billingEndDate?: string;
      selectedInheritedTemplateId?: string;
      studentOverrides?: Array<{
        studentId: string;
        month: string;
        includeIndividualTemplateIds?: string[];
        templateEdits?: Array<{ templateId: string; action: 'exclude' }>;
        metricEdits?: Array<{ templateId: string; metricId: string; action: 'exclude' | 'overrideAmount'; amount?: number }>;
      }>;
    }) => {
      const response = await apiClient.post<FeeChallanGenerateResult[]>('/api/v1/fees/challans/generate', input);
      return response.data ?? [];
    },
  });
}

export function useEnqueueFeeChallanGenerateJob() {
  return useMutation({
    mutationFn: async (input: {
      studentIds: string[];
      months: string[];
      autoCalculateDueDate?: boolean;
      dueDate?: string;
      billingStartDate?: string;
      billingEndDate?: string;
      selectedInheritedTemplateId?: string;
      studentOverrides?: Array<{
        studentId: string;
        month: string;
        includeIndividualTemplateIds?: string[];
        templateEdits?: Array<{ templateId: string; action: 'exclude' }>;
        metricEdits?: Array<{ templateId: string; metricId: string; action: 'exclude' | 'overrideAmount'; amount?: number }>;
      }>;
    }) => {
      const response = await apiClient.post<{ jobId: string }>('/api/v1/fees/challans/generate-jobs', input);
      return response.data?.jobId ?? null;
    },
  });
}

export function useFeeChallanGenerateJob(jobId: string | null) {
  return useQuery({
    queryKey: ['fees', 'challans', 'generate-jobs', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const response = await apiClient.get<FeeChallanGenerateJobStatus>(`/api/v1/fees/challans/generate-jobs/${jobId}`);
      return response.data ?? null;
    },
    enabled: !!jobId,
    // Poll until terminal state
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (!s) return 1500;
      if (s === 'completed' || s === 'failed' || s === 'cancelled') return false;
      return 1500;
    },
    staleTime: 0,
  });
}

export function useInheritedTemplateCandidates(params: { classId?: string; sectionId?: string }) {
  return useQuery({
    queryKey: ['fees', 'challans', 'inherited-template-candidates', params],
    queryFn: async () => {
      if (!params.classId || !params.sectionId) {
        return { level: [], class: [], classSection: [] } as {
          level: Array<{
            templateId: string;
            name: string;
            type: 'Fee' | 'Discount';
            scope: string;
            assignedScopeId: string;
            currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
            metrics: Array<{
              id: string;
              name: string;
              amountType: 'Absolute' | 'Percentage';
              amount: number;
              perDay: boolean;
              displayOrder: number;
            }>;
          }>;
          class: Array<{
            templateId: string;
            name: string;
            type: 'Fee' | 'Discount';
            scope: string;
            assignedScopeId: string;
            currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
            metrics: Array<{
              id: string;
              name: string;
              amountType: 'Absolute' | 'Percentage';
              amount: number;
              perDay: boolean;
              displayOrder: number;
            }>;
          }>;
          classSection: Array<{
            templateId: string;
            name: string;
            type: 'Fee' | 'Discount';
            scope: string;
            assignedScopeId: string;
            currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
            metrics: Array<{
              id: string;
              name: string;
              amountType: 'Absolute' | 'Percentage';
              amount: number;
              perDay: boolean;
              displayOrder: number;
            }>;
          }>;
          discounts?: {
            level: Array<{
              templateId: string;
              name: string;
              type: 'Discount';
              scope: string;
              assignedScopeId: string;
              currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
              metrics: Array<{
                id: string;
                name: string;
                amountType: 'Absolute' | 'Percentage';
                amount: number;
                perDay: boolean;
                displayOrder: number;
              }>;
            }>;
            class: Array<{
              templateId: string;
              name: string;
              type: 'Discount';
              scope: string;
              assignedScopeId: string;
              currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
              metrics: Array<{
                id: string;
                name: string;
                amountType: 'Absolute' | 'Percentage';
                amount: number;
                perDay: boolean;
                displayOrder: number;
              }>;
            }>;
            classSection: Array<{
              templateId: string;
              name: string;
              type: 'Discount';
              scope: string;
              assignedScopeId: string;
              currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
              metrics: Array<{
                id: string;
                name: string;
                amountType: 'Absolute' | 'Percentage';
                amount: number;
                perDay: boolean;
                displayOrder: number;
              }>;
            }>;
          };
        };
      }
      const response = await apiClient.get<{
        level: Array<{
          templateId: string;
          name: string;
          type: 'Fee' | 'Discount';
          scope: string;
          assignedScopeId: string;
          currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
          metrics: Array<{
            id: string;
            name: string;
            amountType: 'Absolute' | 'Percentage';
            amount: number;
            perDay: boolean;
            displayOrder: number;
          }>;
        }>;
        class: Array<{
          templateId: string;
          name: string;
          type: 'Fee' | 'Discount';
          scope: string;
          assignedScopeId: string;
          currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
          metrics: Array<{
            id: string;
            name: string;
            amountType: 'Absolute' | 'Percentage';
            amount: number;
            perDay: boolean;
            displayOrder: number;
          }>;
        }>;
        classSection: Array<{
          templateId: string;
          name: string;
          type: 'Fee' | 'Discount';
          scope: string;
          assignedScopeId: string;
          currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
          metrics: Array<{
            id: string;
            name: string;
            amountType: 'Absolute' | 'Percentage';
            amount: number;
            perDay: boolean;
            displayOrder: number;
          }>;
        }>;
        discounts?: {
          level: Array<{
            templateId: string;
            name: string;
            type: 'Discount';
            scope: string;
            assignedScopeId: string;
            currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
            metrics: Array<{
              id: string;
              name: string;
              amountType: 'Absolute' | 'Percentage';
              amount: number;
              perDay: boolean;
              displayOrder: number;
            }>;
          }>;
          class: Array<{
            templateId: string;
            name: string;
            type: 'Discount';
            scope: string;
            assignedScopeId: string;
            currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
            metrics: Array<{
              id: string;
              name: string;
              amountType: 'Absolute' | 'Percentage';
              amount: number;
              perDay: boolean;
              displayOrder: number;
            }>;
          }>;
          classSection: Array<{
            templateId: string;
            name: string;
            type: 'Discount';
            scope: string;
            assignedScopeId: string;
            currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
            metrics: Array<{
              id: string;
              name: string;
              amountType: 'Absolute' | 'Percentage';
              amount: number;
              perDay: boolean;
              displayOrder: number;
            }>;
          }>;
        };
      }>('/api/v1/fees/challans/inherited-template-candidates', { params });
      return response.data ?? { level: [], class: [], classSection: [] };
    },
    enabled: !!params.classId && !!params.sectionId,
    staleTime: 1000 * 30,
  });
}

export function useFeeChallanPreview(studentId: string | null) {
  return useMutation({
    mutationFn: async (input: FeeChallanPreviewRequest) => {
      if (!studentId) throw new Error('studentId is required');
      const response = await apiClient.post<FeeCalculationPreview>(
        `/api/v1/fees/students/${studentId}/challan-preview`,
        input,
      );
      return response.data;
    },
  });
}

export function useFeeChallanRoster(params: { classId?: string; sectionId?: string; month?: string }) {
  return useQuery({
    queryKey: ['fees', 'challans', 'roster', params],
    queryFn: async () => {
      if (!params.classId || !params.sectionId || !params.month) return [];
      const response = await apiClient.get<
        Array<{
          studentId: string;
          studentName: string;
          parentName: string | null;
          parentIsStaff: boolean;
          status: string | null;
          challanId: string | null;
          challanNumber: string | null;
          pdfUrl: string | null;
        }>
      >('/api/v1/fees/challans/roster', { params });
      return response.data ?? [];
    },
    enabled: !!params.classId && !!params.sectionId && !!params.month,
    staleTime: 1000 * 15,
  });
}

/** Regenerates the receipt PDF on the server, then open the URL with `?v=` cache bust (see PaymentsTab). */
export function useRegenerateFeeReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiClient.post<{ receiptUrl: string | null }>(
        `/api/v1/fees/payments/${paymentId}/regenerate-receipt`,
      );
      return response.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fees', 'payments', 'history'] });
    },
  });
}

export function useFeePaymentsHistory(params: {
  classId?: string;
  sectionId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['fees', 'payments', 'history', params],
    queryFn: async () => {
      const response = await apiClient.get<{
        rows: Array<{
          id: string;
          paymentDate: string;
          studentId: string;
          studentName: string;
          challanNumber: string;
          month: string;
          amountPaid: number;
          status: string;
          receiptUrl: string | null;
          proofDocumentUrl: string | null;
        }>;
        totals: { collected: number; pending: number };
      }>('/api/v1/fees/payments/history', { params });
      return response;
    },
    staleTime: 1000 * 15,
  });
}

export type MyPendingChallanRow = {
  id: string;
  challanNumber: string;
  studentId: string;
  studentName: string;
  month: string;
  payableAmount: number;
  dueDate: string;
  status: string;
  pdfUrl: string | null;
};

export function useMyPendingFeeChallans(params: { mode: 'parent' | 'student' }) {
  return useQuery({
    queryKey: ['fees', 'challans', 'my', params],
    queryFn: async () => {
      const url =
        params.mode === 'student'
          ? '/api/v1/student/fees/challans'
          : '/api/v1/fees/challans/my-students';
      const response = await apiClient.get<MyPendingChallanRow[]>(url);
      return response.data ?? [];
    },
    staleTime: 1000 * 15,
  });
}

export type MyStudentPaymentRow = {
  challanNumber: string;
  studentId: string;
  studentName: string;
  month: string;
  amountPaid: number;
  paymentDate: string;
  status: string;
  receiptUrl: string | null;
  verifiedAt: string | null;
};

export function useMyFeePayments(params: { mode: 'parent' | 'student' }) {
  return useQuery({
    queryKey: ['fees', 'payments', 'my', params],
    queryFn: async () => {
      const url =
        params.mode === 'student'
          ? '/api/v1/student/fees/payments'
          : '/api/v1/fees/payments/my-students';
      const response = await apiClient.get<MyStudentPaymentRow[]>(url);
      return response.data ?? [];
    },
    staleTime: 1000 * 15,
  });
}

export function useSubmitFeePaymentProof(params: { mode: 'parent' | 'student' }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      challanId: string;
      amountPaid: number;
      paymentDate: string;
      paymentMethod: string;
      bankName?: string | null;
      transactionReference?: string | null;
      proofDocument: File;
    }) => {
      const url =
        params.mode === 'student'
          ? '/api/v1/student/fees/payments'
          : '/api/v1/fees/payments';
      const fd = new FormData();
      fd.set('challanId', input.challanId);
      fd.set('amountPaid', String(input.amountPaid));
      fd.set('paymentDate', input.paymentDate);
      fd.set('paymentMethod', input.paymentMethod);
      if (input.bankName) fd.set('bankName', input.bankName);
      if (input.transactionReference) fd.set('transactionReference', input.transactionReference);
      fd.set('proof_document', input.proofDocument);
      const response = await apiClient.post<{ id: string }>(url, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fees', 'challans', 'my'] }),
        qc.invalidateQueries({ queryKey: ['fees', 'payments', 'my'] }),
      ]);
    },
  });
}

/** Student template + preview changes infrequently; longer cache avoids repeat work when opening the challan modal. */
const STUDENT_FEE_TEMPLATES_STALE_MS = 1000 * 60 * 2;

export async function fetchStudentFeeTemplates(
  studentId: string,
  params?: { month?: string },
): Promise<FeeStudentTemplatesResponse | null> {
  const response = await apiClient.get<FeeStudentTemplatesResponse>(`/api/v1/fees/students/${studentId}/templates`, {
    params,
  });
  return response.data ?? null;
}

export function useStudentFeeTemplates(studentId: string | undefined, params?: { month?: string }) {
  return useQuery({
    queryKey: ['fees', 'students', studentId, 'templates', params],
    queryFn: async () => {
      if (!studentId) return null;
      return fetchStudentFeeTemplates(studentId, params);
    },
    enabled: !!studentId,
    staleTime: STUDENT_FEE_TEMPLATES_STALE_MS,
  });
}

/** Warm cache when user hovers a row — modal opens with data ready more often (shared key with useStudentFeeTemplates). */
export function usePrefetchStudentFeeTemplates() {
  const qc = useQueryClient();
  return useCallback(
    (studentId: string, month: string) => {
      return qc.prefetchQuery({
        queryKey: ['fees', 'students', studentId, 'templates', { month }],
        queryFn: () => fetchStudentFeeTemplates(studentId, { month }),
        staleTime: STUDENT_FEE_TEMPLATES_STALE_MS,
      });
    },
    [qc],
  );
}

export function useCreateFeeStudentTemplateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { studentId: string; templateId: string; startDate?: string; endDate?: string }) => {
      const response = await apiClient.post<ApiResponse<{ id: string }>>('/api/v1/fees/student-template-links', input);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ['fees', 'students', variables.studentId, 'templates'] });
      notifications.show({ title: 'Success', message: 'Template linked', color: 'green' });
    },
  });
}

export function useUpdateFeeStudentTemplateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; studentId: string; isActive?: boolean }) => {
      const response = await apiClient.put<ApiResponse<{ id: string }>>(`/api/v1/fees/student-template-links/${input.id}`, {
        isActive: input.isActive,
      });
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ['fees', 'students', variables.studentId, 'templates'] });
      notifications.show({ title: 'Success', message: 'Link updated', color: 'green' });
    },
  });
}

export function useCreateFeeMetricExclusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { studentId: string; templateId: string; metricId: string; reason?: string }) => {
      const response = await apiClient.post<ApiResponse<{ id: string }>>('/api/v1/fees/metric-exclusions', input);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ['fees', 'students', variables.studentId, 'templates'] });
      notifications.show({ title: 'Success', message: 'Metric excluded', color: 'green' });
    },
  });
}

export function useDeleteFeeMetricExclusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; studentId: string }) => {
      await apiClient.delete<ApiResponse<{ success: boolean }>>(`/api/v1/fees/metric-exclusions/${input.id}`);
      return true;
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: ['fees', 'students', variables.studentId, 'templates'] });
      notifications.show({ title: 'Success', message: 'Metric re-included', color: 'green' });
    },
  });
}

