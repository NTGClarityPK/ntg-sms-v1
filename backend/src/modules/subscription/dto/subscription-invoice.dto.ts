import type { BillingCycle, PlanId } from '../plan-config';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface SubscriptionInvoiceLineItemDto {
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

export interface SubscriptionInvoiceDto {
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
  lineItems: SubscriptionInvoiceLineItemDto[];
  hostedInvoiceUrl?: string;
  hasPdf: boolean;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
  /** Set while awaiting Stripe payment for a plan upgrade (hide separate Pay now). */
  pendingUpgradePlanId?: PlanId;
}
