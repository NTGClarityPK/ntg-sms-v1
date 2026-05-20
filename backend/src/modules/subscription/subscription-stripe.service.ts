import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type {
  StripeCheckoutSession,
  StripeClient,
  StripeEvent,
} from './stripe-types';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  BillingCycle,
  PlanId,
} from './plan-config';
import {
  getFrontendUrl,
  getStripeSecretKey,
  isStripeConfigured,
} from './stripe-config';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionService } from './subscription.service';
import type { ChangePlanResultDto } from './dto/subscription.dto';

type InvoiceCheckoutRow = {
  id: string;
  tenant_id: string;
  invoice_number: string;
  plan_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  stripe_checkout_session_id: string | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (error) throw new BadRequestException(error.message);
}

type InvoicePaidRow = {
  id: string;
  tenant_id: string;
  invoice_number: string;
  amount_cents: number;
  status: string;
};

function resolvePaymentIntentId(
  paymentIntent: StripeCheckoutSession['payment_intent'],
): string | null {
  if (!paymentIntent) return null;
  if (typeof paymentIntent === 'string') return paymentIntent;
  return paymentIntent.id ?? null;
}

@Injectable()
export class SubscriptionStripeService {
  private stripe: StripeClient | null = null;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly subscriptionInvoiceService: SubscriptionInvoiceService,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private getStripe(): StripeClient {
    if (!isStripeConfigured()) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    if (!this.stripe) {
      this.stripe = new Stripe(getStripeSecretKey());
    }
    return this.stripe;
  }

  async createUpgradeCheckout(
    tenantId: string,
    targetPlan: PlanId,
    targetCycle: BillingCycle,
    studentsUsed: number,
  ): Promise<ChangePlanResultDto> {
    const supabase = this.supabaseConfig.getClient();
    const stripe = this.getStripe();

    const subscription = await this.subscriptionService.getByTenantId(tenantId);
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, targetCycle);

    const invoice = await this.subscriptionInvoiceService.createPendingUpgradeInvoice({
      tenantId,
      subscriptionId: subscription.id,
      planId: targetPlan,
      billingCycle: targetCycle,
      periodStart: now,
      periodEnd,
      studentsUsed,
    });

    const customerId = await this.getOrCreateStripeCustomer(tenantId);
    const frontendUrl = getFrontendUrl();
    const currency = (invoice.currency || 'USD').toLowerCase();
    const planLabel = targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${invoice.invoiceNumber} — Upgrade to Alma ${planLabel}`,
              description: `Billing period: ${new Date(invoice.periodStart).toLocaleDateString('en-GB')} – ${new Date(invoice.periodEnd).toLocaleDateString('en-GB')}`,
            },
            unit_amount: invoice.amountCents,
          },
          quantity: 1,
        },
      ],
      payment_method_types: ['card'],
      success_url: `${frontendUrl}/billing?payment=success&upgrade=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing?payment=cancelled&upgrade=1`,
      metadata: {
        tenantId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        checkoutType: 'plan_upgrade',
        targetPlan,
        targetBillingCycle: targetCycle,
      },
      expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create Stripe checkout session');
    }

    const { error: updateError } = await supabase
      .from('subscription_invoices')
      .update({
        stripe_checkout_session_id: session.id,
        payment_provider: 'stripe',
      })
      .eq('id', invoice.id)
      .eq('tenant_id', tenantId);

    throwIfDbError(updateError);

    return {
      type: 'checkout_required',
      message: 'Complete payment to activate your new plan',
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  private calculatePeriodEnd(start: Date, cycle: BillingCycle): Date {
    const end = new Date(start);
    if (cycle === BillingCycle.YEARLY) {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return end;
  }

  async createCheckoutForInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ data: { checkoutUrl: string; sessionId: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const stripe = this.getStripe();

    const { data: invoice, error } = await supabase
      .from('subscription_invoices')
      .select(
        'id, tenant_id, invoice_number, plan_id, amount_cents, currency, status, period_start, period_end, stripe_checkout_session_id',
      )
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const row = invoice as InvoiceCheckoutRow;
    if (row.status === 'paid') {
      throw new BadRequestException('Invoice already paid');
    }
    if (row.status === 'void') {
      throw new BadRequestException('Invoice is void');
    }
    if (row.amount_cents <= 0) {
      throw new BadRequestException('Invoice has no payable amount');
    }

    const customerId = await this.getOrCreateStripeCustomer(tenantId);
    const frontendUrl = getFrontendUrl();
    const currency = (row.currency || 'USD').toLowerCase();
    const planLabel = row.plan_id.charAt(0).toUpperCase() + row.plan_id.slice(1);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${row.invoice_number} — Alma ${planLabel} plan`,
              description: `Billing period: ${new Date(row.period_start).toLocaleDateString('en-GB')} – ${new Date(row.period_end).toLocaleDateString('en-GB')}`,
            },
            unit_amount: row.amount_cents,
          },
          quantity: 1,
        },
      ],
      payment_method_types: ['card'],
      success_url: `${frontendUrl}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing?payment=cancelled`,
      metadata: {
        tenantId,
        invoiceId: row.id,
        invoiceNumber: row.invoice_number,
        checkoutType: 'invoice_payment',
      },
      expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create Stripe checkout session');
    }

    const { error: updateError } = await supabase
      .from('subscription_invoices')
      .update({
        stripe_checkout_session_id: session.id,
        payment_provider: 'stripe',
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    throwIfDbError(updateError);

    return {
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    };
  }

  /**
   * Completes upgrade + marks invoice paid when user returns from Stripe (idempotent with webhook).
   */
  async confirmCheckoutSession(
    tenantId: string,
    sessionId: string,
  ): Promise<{
    data: {
      invoiceStatus: string;
      planId: string;
      upgraded: boolean;
    };
  }> {
    const stripe = this.getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.tenantId !== tenantId) {
      throw new BadRequestException('Checkout session does not belong to this school');
    }

    if (session.payment_status !== 'paid') {
      throw new BadRequestException('Payment has not been completed yet');
    }

    await this.handleCheckoutSessionCompleted(
      session as StripeCheckoutSession,
      `confirm-${sessionId}`,
    );

    const subscription = await this.subscriptionService.getByTenantId(tenantId);
    const supabase = this.supabaseConfig.getClient();
    const invoiceId = session.metadata?.invoiceId;
    let invoiceStatus = 'paid';

    if (invoiceId) {
      const { data: invoice } = await supabase
        .from('subscription_invoices')
        .select('status')
        .eq('id', invoiceId)
        .maybeSingle();
      invoiceStatus = (invoice as { status?: string } | null)?.status ?? 'paid';
    }

    const targetPlan = session.metadata?.targetPlan;
    const upgraded =
      !targetPlan || subscription.planId === targetPlan;

    return {
      data: {
        invoiceStatus,
        planId: subscription.planId,
        upgraded,
      },
    };
  }

  async createCustomerPortalSession(
    tenantId: string,
  ): Promise<{ data: { url: string } }> {
    const stripe = this.getStripe();
    const customerId = await this.getOrCreateStripeCustomer(tenantId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getFrontendUrl()}/billing`,
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create customer portal session');
    }

    return { data: { url: session.url } };
  }

  async handleStripeWebhookEvent(event: StripeEvent): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as StripeCheckoutSession,
          event.id,
        );
        break;
      case 'checkout.session.expired': {
        const session = event.data.object as StripeCheckoutSession;
        await this.clearCheckoutSessionId(session.id);
        await this.logPaymentEvent({
          provider: 'stripe',
          eventType: 'checkout.session.expired',
          externalEventId: event.id,
          tenantId: session.metadata?.tenantId,
          subscriptionInvoiceId: session.metadata?.invoiceId,
          payload: { sessionId: session.id },
        });
        break;
      }
      default:
        break;
    }
  }

  private async handleCheckoutSessionCompleted(
    session: StripeCheckoutSession,
    stripeEventId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const invoiceId = session.metadata?.invoiceId;
    const tenantId = session.metadata?.tenantId;

    let invoiceRow: InvoicePaidRow | null = null;

    if (session.id) {
      const { data } = await supabase
        .from('subscription_invoices')
        .select('id, tenant_id, invoice_number, amount_cents, status')
        .eq('stripe_checkout_session_id', session.id)
        .maybeSingle();
      invoiceRow = (data as InvoicePaidRow | null) ?? null;
    }

    if (!invoiceRow && invoiceId) {
      const { data } = await supabase
        .from('subscription_invoices')
        .select('id, tenant_id, invoice_number, amount_cents, status')
        .eq('id', invoiceId)
        .maybeSingle();
      invoiceRow = (data as InvoicePaidRow | null) ?? null;
    }

    if (!invoiceRow) {
      return;
    }

    if (invoiceRow.status === 'paid') {
      await this.subscriptionService.fulfillPaidUpgradeInvoice(
        invoiceRow.tenant_id ?? tenantId ?? '',
        invoiceRow.id,
      );
      return;
    }

    const resolvedTenantId = invoiceRow.tenant_id ?? tenantId ?? '';

    await this.subscriptionService.fulfillPaidUpgradeInvoice(
      resolvedTenantId,
      invoiceRow.id,
    );

    const paymentIntentId = resolvePaymentIntentId(session.payment_intent);
    const hostedInvoiceUrl =
      typeof session.url === 'string' ? session.url : undefined;

    const { error: updateError } = await supabase
      .from('subscription_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        payment_provider: 'stripe',
        ...(hostedInvoiceUrl ? { hosted_invoice_url: hostedInvoiceUrl } : {}),
      })
      .eq('id', invoiceRow.id);

    throwIfDbError(updateError);

    await this.subscriptionInvoiceService.refreshInvoicePdf(invoiceRow.id);

    await this.logPaymentEvent({
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      externalEventId: stripeEventId,
      tenantId: invoiceRow.tenant_id ?? tenantId,
      subscriptionInvoiceId: invoiceRow.id,
      payload: {
        invoiceNumber: invoiceRow.invoice_number,
        amountCents: invoiceRow.amount_cents,
        sessionId: session.id,
        paymentIntentId,
      },
    });
  }

  private async clearCheckoutSessionId(sessionId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    await supabase
      .from('subscription_invoices')
      .update({ stripe_checkout_session_id: null })
      .eq('stripe_checkout_session_id', sessionId)
      .neq('status', 'paid');
  }

  private async getOrCreateStripeCustomer(tenantId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    throwIfDbError(subError);

    const existingId = (subscription as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id;
    if (existingId) return existingId;

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name, email')
      .eq('id', tenantId)
      .maybeSingle();

    throwIfDbError(tenantError);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const tenantRow = tenant as { name: string; email: string | null };
    let email = tenantRow.email?.trim() || '';
    if (!email) {
      email = await this.resolveSchoolAdminEmail(tenantId);
    }

    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      name: tenantRow.name,
      ...(email ? { email } : {}),
      metadata: { tenantId },
    });

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        stripe_customer_id: customer.id,
        payment_provider: 'stripe',
      })
      .eq('tenant_id', tenantId);

    throwIfDbError(updateError);

    return customer.id;
  }

  private async resolveSchoolAdminEmail(tenantId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();

    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const branchIds = (branches ?? []).map((b: { id: string }) => b.id);
    if (branchIds.length === 0) return '';

    const { data: schoolAdminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'school_admin')
      .maybeSingle();

    const roleId = (schoolAdminRole as { id: string } | null)?.id;
    if (!roleId) return '';

    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('branch_id', branchIds)
      .eq('role_id', roleId)
      .limit(1);

    const userId = (userRoles?.[0] as { user_id: string } | undefined)?.user_id;
    if (!userId) return '';

    const { data: emails, error } = await supabase.rpc('get_auth_user_emails', {
      p_user_ids: [userId],
    });

    if (error) return '';

    const row = (emails as Array<{ id: string; email: string | null }> | null)?.[0];
    return row?.email?.trim() ?? '';
  }

  private async logPaymentEvent(input: {
    provider: 'stripe';
    eventType: string;
    externalEventId: string;
    tenantId?: string;
    subscriptionInvoiceId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.from('billing_payment_events').insert({
      provider: input.provider,
      event_type: input.eventType,
      external_event_id: input.externalEventId,
      tenant_id: input.tenantId ?? null,
      subscription_invoice_id: input.subscriptionInvoiceId ?? null,
      payload: input.payload,
    });

    if (error?.code === '23505') {
      return;
    }
    throwIfDbError(error);
  }
}
