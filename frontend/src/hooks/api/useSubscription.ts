'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type {
  ChangePlanResult,
  PlanConfig,
  Subscription,
  SubscriptionInvoice,
  SubscriptionUsageWithLimits,
  TenantSubscriptionSummary,
  BillingCycle,
  PlanId,
} from '@/types/subscription';

export const subscriptionKeys = {
  all: ['subscription'] as const,
  me: () => [...subscriptionKeys.all, 'me'] as const,
  usage: (refresh?: boolean) => [...subscriptionKeys.all, 'usage', refresh] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  adminList: () => [...subscriptionKeys.all, 'admin'] as const,
  invoices: (page?: number) => [...subscriptionKeys.all, 'invoices', page] as const,
};

function useIsSchoolAdmin(): boolean {
  const { user } = useAuth();
  return (
    user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'school_admin') ?? false
  );
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: async () => {
      const res = await apiClient.get<PlanConfig[]>('/api/v1/subscription/plans');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubscription() {
  const isSchoolAdmin = useIsSchoolAdmin();
  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  return useQuery({
    queryKey: subscriptionKeys.me(),
    queryFn: async () => {
      const res = await apiClient.get<Subscription>('/api/v1/subscription');
      return res.data;
    },
    enabled: isSchoolAdmin && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSubscriptionUsage(refresh = false) {
  const isSchoolAdmin = useIsSchoolAdmin();
  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  return useQuery({
    queryKey: subscriptionKeys.usage(refresh),
    queryFn: async () => {
      const res = await apiClient.get<SubscriptionUsageWithLimits>(
        '/api/v1/subscription/usage',
        { params: refresh ? { refresh: 'true' } : undefined },
      );
      return res.data;
    },
    enabled: isSchoolAdmin && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: PlanId; billingCycle?: BillingCycle }) => {
      const res = await apiClient.post<ChangePlanResult>(
        '/api/v1/subscription/change-plan',
        input,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
      void qc.invalidateQueries({ queryKey: [...subscriptionKeys.all, 'invoices'] });
    },
  });
}

export function useSubscriptionInvoices(page = 1, limit = 20) {
  const isSchoolAdmin = useIsSchoolAdmin();
  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  return useQuery({
    queryKey: subscriptionKeys.invoices(page),
    queryFn: async () => {
      const res = await apiClient.get<SubscriptionInvoice[]>(
        '/api/v1/subscription/invoices',
        { params: { page, limit } },
      );
      return res;
    },
    enabled: isSchoolAdmin && !!branchId,
    staleTime: 60 * 1000,
  });
}

export function usePaymentConfig() {
  const isSchoolAdmin = useIsSchoolAdmin();
  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  return useQuery({
    queryKey: [...subscriptionKeys.all, 'payment-config'],
    queryFn: async () => {
      const res = await apiClient.get<{ stripeEnabled: boolean }>(
        '/api/v1/subscription/payment-config',
      );
      return res.data;
    },
    enabled: isSchoolAdmin && !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConfirmCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiClient.post<{
        invoiceStatus: string;
        planId: string;
        upgraded: boolean;
      }>('/api/v1/subscription/checkout/confirm', { sessionId });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useCreateInvoiceCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiClient.post<{ checkoutUrl: string; sessionId: string }>(
        `/api/v1/subscription/invoices/${invoiceId}/checkout`,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...subscriptionKeys.all, 'invoices'] });
    },
  });
}

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get<{ url: string }>(
        '/api/v1/subscription/customer-portal',
      );
      return res.data;
    },
  });
}

export function useSubscriptionInvoiceDownload() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiClient.get<{ url: string }>(
        `/api/v1/subscription/invoices/${invoiceId}/download`,
      );
      return res.data;
    },
  });
}

export function useClearPendingPlanChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete('/api/v1/subscription/pending-change');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: subscriptionKeys.adminList(),
    queryFn: async () => {
      const res = await apiClient.get<TenantSubscriptionSummary[]>(
        '/api/v1/admin/subscriptions',
      );
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tenantId: string;
      planId?: PlanId;
      billingCycle?: BillingCycle;
      status?: string;
      notes?: string;
      clearPending?: boolean;
    }) => {
      const { tenantId, ...body } = input;
      const res = await apiClient.patch<Subscription>(
        `/api/v1/admin/subscriptions/${tenantId}`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.adminList() });
    },
  });
}

export function useAdminSyncSubscriptionUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      await apiClient.post(`/api/v1/admin/subscriptions/${tenantId}/sync-usage`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.adminList() });
    },
  });
}

/** Plan features for current tenant (all portal users with a branch). */
export function useSubscriptionFeatures() {
  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  return useQuery({
    queryKey: [...subscriptionKeys.all, 'features', branchId],
    queryFn: async () => {
      const [plansRes, planRes] = await Promise.all([
        apiClient.get<PlanConfig[]>('/api/v1/subscription/plans'),
        apiClient.get<{ planId: PlanId }>('/api/v1/subscription/current-plan'),
      ]);
      const plans = plansRes.data;
      const planId = planRes.data?.planId ?? 'free';
      const current = plans.find((p) => p.id === planId) ?? plans[0];
      return current?.features ?? plans[0]?.features;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}
