export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  tenantId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  pendingPlanId?: PlanId;
  pendingBillingCycle?: BillingCycle;
  cancelledAt?: string;
  notes?: string;
}

export interface SubscriptionUsage {
  branchesUsed: number;
  studentsUsed: number;
  staffUsed: number;
  classesUsed: number;
  storageUsedMb: number;
  reportsThisMonth: number;
  smsThisMonth: number;
  lastResetAt: string;
}

export interface PlanLimits {
  branches: number;
  students: number;
  staff: number;
  classes: number;
  storageMB: number;
  monthlyReports: number;
  monthlySMS: number;
}

export interface PlanFeatures {
  hasFeeManagement: boolean;
  hasAdvancedReports: boolean;
  hasResultCards: boolean;
  hasParentPortal: boolean;
  hasSMSNotifications: boolean;
  hasTimetable: boolean;
  hasMultiBranch: boolean;
  hasCustomBranding: boolean;
  hasAPIAccess: boolean;
  hasBehavioralTracking: boolean;
  hasLibraryManagement: boolean;
  hasInventoryManagement: boolean;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  order: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface SubscriptionUsageWithLimits {
  usage: SubscriptionUsage;
  limits: PlanLimits;
  planId: PlanId;
}

export type ChangePlanResultType =
  | 'noop'
  | 'upgrade'
  | 'downgrade-scheduled'
  | 'pending-cleared'
  | 'contact-sales'
  | 'checkout_required';

export interface ChangePlanResult {
  type: ChangePlanResultType;
  subscription?: Subscription;
  message?: string;
  effectiveDate?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

export interface TenantSubscriptionSummary {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  subscription: Subscription;
  usage: SubscriptionUsage;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export interface SubscriptionInvoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  paymentProvider: 'manual' | 'stripe';
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmountCents: number;
    amountCents: number;
  }>;
  hostedInvoiceUrl?: string;
  hasPdf: boolean;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
  pendingUpgradePlanId?: PlanId;
}
