import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  BillingCycle,
  parsePlanId,
  PlanId,
} from './plan-config';
import {
  calculateSubscriptionInvoiceAmount,
  type InvoiceLineItem,
} from './plan-pricing';
import { SubscriptionInvoicePdfService } from './subscription-invoice-pdf.service';
import type {
  InvoiceStatus,
  SubscriptionInvoiceDto,
  SubscriptionInvoiceLineItemDto,
} from './dto/subscription-invoice.dto';

type InvoiceRow = {
  id: string;
  tenant_id: string;
  subscription_id: string;
  invoice_number: string;
  plan_id: string;
  billing_cycle: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_provider: string;
  line_items: SubscriptionInvoiceLineItemDto[] | null;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  pdf_storage_path: string | null;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  pending_upgrade_plan_id: string | null;
  pending_upgrade_billing_cycle: string | null;
};

const INVOICE_SELECT =
  'id, tenant_id, subscription_id, invoice_number, plan_id, billing_cycle, period_start, period_end, amount_cents, currency, status, payment_provider, line_items, stripe_invoice_id, hosted_invoice_url, pdf_storage_path, issued_at, due_at, paid_at, pending_upgrade_plan_id, pending_upgrade_billing_cycle';

function throwIfDbError(error: PostgrestError | null): void {
  if (error) throw new BadRequestException(error.message);
}

@Injectable()
export class SubscriptionInvoiceService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly pdfService: SubscriptionInvoicePdfService,
  ) {}

  async listForTenant(
    tenantId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: SubscriptionInvoiceDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    const { data, error, count } = await supabase
      .from('subscription_invoices')
      .select(INVOICE_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false })
      .range(from, to);

    throwIfDbError(error);
    const total = count ?? 0;
    const rows = (data ?? []) as InvoiceRow[];

    return {
      data: rows.map((r) => this.mapInvoice(r)),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  async getDownloadUrl(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ data: { url: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscription_invoices')
      .select('hosted_invoice_url, pdf_storage_path, tenant_id')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Invoice not found');

    const row = data as {
      hosted_invoice_url: string | null;
      pdf_storage_path: string | null;
    };

    if (row.hosted_invoice_url) {
      return { data: { url: row.hosted_invoice_url } };
    }

    if (!row.pdf_storage_path) {
      throw new NotFoundException('Invoice PDF is not available');
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('subscription-invoices')
      .createSignedUrl(row.pdf_storage_path, 3600);

    if (signError || !signed?.signedUrl) {
      throw new BadRequestException('Failed to generate download link');
    }

    return { data: { url: signed.signedUrl } };
  }

  /**
   * Open invoice for a plan upgrade awaiting Stripe payment (subscription not changed yet).
   */
  async createPendingUpgradeInvoice(input: {
    tenantId: string;
    subscriptionId: string;
    planId: PlanId;
    billingCycle: BillingCycle;
    periodStart: Date;
    periodEnd: Date;
    studentsUsed: number;
  }): Promise<SubscriptionInvoiceDto> {
    const plan = parsePlanId(input.planId) ?? input.planId;
    const breakdown = calculateSubscriptionInvoiceAmount(
      plan,
      input.billingCycle,
      input.studentsUsed,
    );
    if (!breakdown || breakdown.amountCents <= 0) {
      throw new BadRequestException('Upgrade has no payable amount');
    }

    const supabase = this.supabaseConfig.getClient();

    const { data: existingOpen } = await supabase
      .from('subscription_invoices')
      .select(INVOICE_SELECT)
      .eq('tenant_id', input.tenantId)
      .eq('status', 'open')
      .eq('pending_upgrade_plan_id', plan)
      .eq('pending_upgrade_billing_cycle', input.billingCycle)
      .maybeSingle();

    if (existingOpen) {
      return this.mapInvoice(existingOpen as InvoiceRow);
    }

    const idempotencyKey = [
      'pending-upgrade',
      input.tenantId,
      plan,
      input.billingCycle,
      input.periodStart.toISOString(),
    ].join(':');

    const { data: existingByKey } = await supabase
      .from('subscription_invoices')
      .select(INVOICE_SELECT)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingByKey) {
      return this.mapInvoice(existingByKey as InvoiceRow);
    }

    const issuedAt = new Date();
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + 14);
    const invoiceNumber = await this.generateInvoiceNumber(input.tenantId);

    const { data: inserted, error } = await supabase
      .from('subscription_invoices')
      .insert({
        tenant_id: input.tenantId,
        subscription_id: input.subscriptionId,
        invoice_number: invoiceNumber,
        plan_id: plan,
        billing_cycle: input.billingCycle,
        period_start: input.periodStart.toISOString(),
        period_end: input.periodEnd.toISOString(),
        amount_cents: breakdown.amountCents,
        currency: breakdown.currency,
        status: 'open',
        payment_provider: 'stripe',
        line_items: breakdown.lineItems,
        issued_at: issuedAt.toISOString(),
        due_at: dueAt.toISOString(),
        idempotency_key: idempotencyKey,
        pending_upgrade_plan_id: plan,
        pending_upgrade_billing_cycle: input.billingCycle,
      })
      .select(INVOICE_SELECT)
      .single();

    throwIfDbError(error);
    if (!inserted) {
      throw new BadRequestException('Failed to create upgrade invoice');
    }

    await this.generateAndStorePdf(inserted as InvoiceRow);

    const { data: refreshed } = await supabase
      .from('subscription_invoices')
      .select(INVOICE_SELECT)
      .eq('id', (inserted as InvoiceRow).id)
      .single();

    return this.mapInvoice((refreshed ?? inserted) as InvoiceRow);
  }

  async ensurePeriodInvoice(input: {
    tenantId: string;
    subscriptionId: string;
    planId: PlanId;
    billingCycle: BillingCycle;
    periodStart: Date;
    periodEnd: Date;
    studentsUsed: number;
    reason: 'upgrade' | 'renewal' | 'admin';
  }): Promise<SubscriptionInvoiceDto | null> {
    const plan = parsePlanId(input.planId) ?? input.planId;
    if (plan === PlanId.FREE || plan === PlanId.ENTERPRISE) {
      return null;
    }

    const breakdown = calculateSubscriptionInvoiceAmount(
      plan,
      input.billingCycle,
      input.studentsUsed,
    );
    if (!breakdown || breakdown.amountCents <= 0) {
      return null;
    }

    const idempotencyKey = [
      input.tenantId,
      plan,
      input.billingCycle,
      input.periodStart.toISOString(),
      input.periodEnd.toISOString(),
    ].join(':');

    const supabase = this.supabaseConfig.getClient();
    const { data: existing } = await supabase
      .from('subscription_invoices')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      const { data: full } = await supabase
        .from('subscription_invoices')
        .select(INVOICE_SELECT)
        .eq('id', (existing as { id: string }).id)
        .single();
      return full ? this.mapInvoice(full as InvoiceRow) : null;
    }

    const issuedAt = new Date();
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + 14);

    const invoiceNumber = await this.generateInvoiceNumber(input.tenantId);

    const { data: inserted, error } = await supabase
      .from('subscription_invoices')
      .insert({
        tenant_id: input.tenantId,
        subscription_id: input.subscriptionId,
        invoice_number: invoiceNumber,
        plan_id: plan,
        billing_cycle: input.billingCycle,
        period_start: input.periodStart.toISOString(),
        period_end: input.periodEnd.toISOString(),
        amount_cents: breakdown.amountCents,
        currency: breakdown.currency,
        status: 'open',
        payment_provider: 'manual',
        line_items: breakdown.lineItems,
        issued_at: issuedAt.toISOString(),
        due_at: dueAt.toISOString(),
        idempotency_key: idempotencyKey,
      })
      .select(INVOICE_SELECT)
      .single();

    throwIfDbError(error);
    if (!inserted) return null;

    const invoice = this.mapInvoice(inserted as InvoiceRow);
    await this.generateAndStorePdf(inserted as InvoiceRow);
    await this.logPaymentEvent({
      provider: 'manual',
      eventType: `invoice.created.${input.reason}`,
      externalEventId: `manual-${invoice.id}-${Date.now()}`,
      subscriptionInvoiceId: invoice.id,
      tenantId: input.tenantId,
      payload: { reason: input.reason, amountCents: breakdown.amountCents },
    });

    const { data: refreshed } = await supabase
      .from('subscription_invoices')
      .select(INVOICE_SELECT)
      .eq('id', invoice.id)
      .single();

    return refreshed ? this.mapInvoice(refreshed as InvoiceRow) : invoice;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { count } = await supabase
      .from('subscription_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const seq = String((count ?? 0) + 1).padStart(4, '0');
    const token = randomBytes(4).toString('hex').toUpperCase();
    return `INV-${token}-${seq}`;
  }

  private async generateAndStorePdf(row: InvoiceRow): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', row.tenant_id)
      .maybeSingle();

    const tenantName = (tenant as { name?: string } | null)?.name ?? 'School';
    const planLabel =
      row.plan_id.charAt(0).toUpperCase() + row.plan_id.slice(1);

    const lineItems = (row.line_items ?? []) as InvoiceLineItem[];

    const pdfBuffer = await this.pdfService.generateInvoicePdf({
      invoiceNumber: row.invoice_number,
      tenantName,
      planLabel,
      billingCycle: row.billing_cycle,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      issuedAt: row.issued_at,
      dueAt: row.due_at ?? undefined,
      status: row.status,
      amountCents: row.amount_cents,
      currency: row.currency,
      lineItems,
    });

    const filePath = `${row.tenant_id}/${row.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('subscription-invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) return;

    await supabase
      .from('subscription_invoices')
      .update({ pdf_storage_path: filePath })
      .eq('id', row.id);
  }

  private async logPaymentEvent(input: {
    provider: 'manual' | 'stripe';
    eventType: string;
    externalEventId: string;
    subscriptionInvoiceId?: string;
    tenantId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    await supabase.from('billing_payment_events').insert({
      provider: input.provider,
      event_type: input.eventType,
      external_event_id: input.externalEventId,
      subscription_invoice_id: input.subscriptionInvoiceId ?? null,
      tenant_id: input.tenantId ?? null,
      payload: input.payload,
    });
  }

  async refreshInvoicePdf(invoiceId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('subscription_invoices')
      .select(INVOICE_SELECT)
      .eq('id', invoiceId)
      .maybeSingle();
    throwIfDbError(error);
    if (data) {
      await this.generateAndStorePdf(data as InvoiceRow);
    }
  }

  private mapInvoice(row: InvoiceRow): SubscriptionInvoiceDto {
    const planId = parsePlanId(row.plan_id) ?? PlanId.FREE;
    const billingCycle =
      row.billing_cycle === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
    const pendingUpgradePlanId = parsePlanId(row.pending_upgrade_plan_id ?? '');

    return {
      id: row.id,
      tenantId: row.tenant_id,
      subscriptionId: row.subscription_id,
      invoiceNumber: row.invoice_number,
      planId,
      billingCycle,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status as InvoiceStatus,
      paymentProvider: row.payment_provider as 'manual' | 'stripe',
      lineItems: row.line_items ?? [],
      hostedInvoiceUrl: row.hosted_invoice_url ?? undefined,
      hasPdf: Boolean(row.pdf_storage_path || row.hosted_invoice_url),
      issuedAt: row.issued_at,
      dueAt: row.due_at ?? undefined,
      paidAt: row.paid_at ?? undefined,
      ...(pendingUpgradePlanId
        ? { pendingUpgradePlanId }
        : {}),
    };
  }
}
