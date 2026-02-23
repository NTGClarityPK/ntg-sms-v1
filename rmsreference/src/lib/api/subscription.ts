import apiClient from './client';

export enum PlanId {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface SubscriptionResponse {
  id: string;
  tenantId: string;
  planId: PlanId;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  subscriptionId: string;
  branchesUsed: number;
  usersUsed: number;
  ordersCount: number;
  menuItemsUsed: number;
  storageUsedMb: number;
  recordedAt: Date;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  tenantId: string;
  amount: number;
  status: string;
  invoiceNumber: string;
  invoicePdfUrl?: string;
  periodStart: Date;
  periodEnd: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanConfig {
  name: string;
  price: number;
  locations: number | 'unlimited';
  users: number | 'unlimited';
  menuItems: number | 'unlimited';
  ordersMonth: number | 'unlimited';
  features: string[];
  languages: string[];
  hasReports: boolean;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export const subscriptionApi = {
  /**
   * Get current subscription
   */
  getSubscription: async (): Promise<SubscriptionResponse> => {
    const response = await apiClient.get<SubscriptionResponse>('/subscription');
    return response.data;
  },

  /**
   * Create free subscription
   */
  createFreeSubscription: async (): Promise<SubscriptionResponse> => {
    const response = await apiClient.post<SubscriptionResponse>('/subscription', {
      planId: PlanId.FREE,
    });
    return response.data;
  },

  /**
   * Create Stripe checkout session
   */
  createCheckoutSession: async (
    planId: PlanId,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSessionResponse> => {
    const response = await apiClient.post<CheckoutSessionResponse>(
      '/subscription/checkout',
      {
        planId,
        successUrl,
        cancelUrl,
      },
    );
    return response.data;
  },

  /**
   * Upgrade subscription plan
   */
  upgradePlan: async (
    planId: PlanId,
  ): Promise<{ subscription: SubscriptionResponse; proratedAmount: number }> => {
    const response = await apiClient.put<{
      subscription: SubscriptionResponse;
      proratedAmount: number;
    }>('/subscription/upgrade', { planId });
    return response.data;
  },

  /**
   * Downgrade subscription plan
   */
  downgradePlan: async (planId: PlanId): Promise<SubscriptionResponse> => {
    const response = await apiClient.put<SubscriptionResponse>(
      '/subscription/downgrade',
      { planId },
    );
    return response.data;
  },

  /**
   * Cancel subscription
   */
  cancelSubscription: async (): Promise<SubscriptionResponse> => {
    const response = await apiClient.delete<SubscriptionResponse>('/subscription');
    return response.data;
  },

  /**
   * Get usage metrics
   */
  getUsage: async (): Promise<SubscriptionUsage> => {
    const response = await apiClient.get<SubscriptionUsage>('/subscription/usage');
    return response.data;
  },

  /**
   * Get invoices
   */
  getInvoices: async (): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>('/subscription/invoices');
    return response.data;
  },

  /**
   * Get plan limits
   */
  getPlanLimits: async (planId: PlanId): Promise<PlanConfig> => {
    const response = await apiClient.get<PlanConfig>(
      `/subscription/plan-limits/${planId}`,
    );
    return response.data;
  },

  /**
   * Check if tenant has access to a feature
   */
  hasFeatureAccess: async (feature: string): Promise<boolean> => {
    const response = await apiClient.get<{ hasAccess: boolean }>(
      `/subscription/has-feature/${feature}`,
    );
    return response.data.hasAccess;
  },

  /**
   * Check if tenant has access to Reports
   */
  hasReportsAccess: async (): Promise<boolean> => {
    const response = await apiClient.get<{ hasAccess: boolean }>(
      '/subscription/has-reports',
    );
    return response.data.hasAccess;
  },

  /**
   * Check if tenant can use a language
   */
  canUseLanguage: async (language: string): Promise<boolean> => {
    const response = await apiClient.get<{ canUse: boolean }>(
      `/subscription/can-use-language/${language}`,
    );
    return response.data.canUse;
  },
};

