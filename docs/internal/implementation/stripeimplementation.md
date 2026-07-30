# Stripe Payment Integration for Alma - Complete Guide

> **Goal:** Use Stripe to collect payments for your existing invoices  
> **What we're NOT doing:** Recurring subscriptions, Dashboard products, automatic billing  
> **What we ARE doing:** Add "Pay Now" button → Stripe Checkout → Mark invoice paid

---

## Overview

```
Your System (Already Built)          Stripe (Payment Processor)
─────────────────────────           ───────────────────────────
✅ Calculate invoice amount    →    🆕 Checkout page
✅ Generate PDF                →    🆕 Process payment
✅ Store in database           →    🆕 Send confirmation
✅ Show billing history        →    🆕 Webhook callback
                                    ✓ Mark invoice paid
```

**Zero Dashboard setup needed!** All pricing done in your code.

---

## Part 1: Stripe Account Setup (5 minutes)

### 1.1 Create Account

1. Go to https://dashboard.stripe.com/register
2. Sign up with email
3. **Stay in Test Mode** (toggle in top-left corner should say "Test mode")

### 1.2 Get API Keys

1. Dashboard → Developers → API keys
2. Copy these two keys:

```
Publishable key: pk_test_51xxxxxxxxxxxxx
Secret key: sk_test_51xxxxxxxxxxxxx
```

### 1.3 Set Up Webhook Endpoint (We'll create the endpoint first, then come back here)

Skip this for now - we'll return after creating the backend.

---

## Part 2: Backend Implementation

### 2.1 Install Stripe Package

```bash
cd backend
npm install stripe
```

### 2.2 Environment Variables

**File:** `backend/.env`

Add these lines:

```env
# Stripe Configuration (Test Mode)
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# App URLs
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
```

Replace `sk_test_51xxx` with your actual secret key from step 1.2.

### 2.3 Add Database Column (If Not Already Present)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_stripe_checkout_session.sql`

```sql
-- Add column to track Stripe checkout session
ALTER TABLE subscription_invoices
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255);

-- Add index
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_session 
ON subscription_invoices(stripe_checkout_session_id);
```

Run migration:

```bash
# If using Supabase CLI
supabase db push

# Or run directly in Supabase Dashboard → SQL Editor
```

### 2.4 Update Subscription Service

**File:** `backend/src/modules/subscription/subscription.service.ts`

Add these imports at the top:

```typescript
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
```

Add Stripe initialization in constructor:

```typescript
@Injectable()
export class SubscriptionService {
  private stripe: Stripe;

  constructor(
    @Inject('SUPABASE_CLIENT') private supabase: SupabaseClient,
    private configService: ConfigService,
  ) {
    // Initialize Stripe
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }

  // ... existing methods ...
```

Add these new methods at the end of the service:

```typescript
  /**
   * Create Stripe checkout session for an existing invoice
   */
  async createCheckoutForInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    // 1. Get the invoice
    const { data: invoice, error } = await this.supabase
      .from('subscription_invoices')
      .select(`
        *,
        subscription:subscriptions(plan_id, billing_cycle)
      `)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice already paid');
    }

    // 2. Get tenant details for Stripe customer
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('name, email')
      .eq('id', tenantId)
      .single();

    // 3. Get or create Stripe customer
    const customerId = await this.getOrCreateStripeCustomer(tenantId, tenant);

    // 4. Create Stripe checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment', // One-time payment
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${invoice.invoice_number} - Alma ${invoice.subscription.plan_id.toUpperCase()} Plan`,
              description: `Billing period: ${new Date(invoice.period_start).toLocaleDateString('en-US')} - ${new Date(invoice.period_end).toLocaleDateString('en-US')}`,
            },
            unit_amount: invoice.amount_cents, // Already calculated by your system
          },
          quantity: 1,
        },
      ],
      payment_method_types: ['card'], // Accept cards only (for now)
      success_url: `${this.configService.get('APP_URL')}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('APP_URL')}/billing?payment=cancelled`,
      metadata: {
        tenantId,
        invoiceId,
        invoiceNumber: invoice.invoice_number,
      },
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    });

    // 5. Save checkout session ID to invoice
    await this.supabase
      .from('subscription_invoices')
      .update({
        stripe_checkout_session_id: session.id,
        status: 'pending', // Mark as pending payment
      })
      .eq('id', invoiceId);

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Get or create Stripe customer for tenant
   */
  private async getOrCreateStripeCustomer(
    tenantId: string,
    tenant?: { name: string; email: string },
  ): Promise<string> {
    // Check if customer already exists
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .single();

    if (subscription?.stripe_customer_id) {
      return subscription.stripe_customer_id;
    }

    // Get tenant details if not provided
    if (!tenant) {
      const { data } = await this.supabase
        .from('tenants')
        .select('name, email')
        .eq('id', tenantId)
        .single();
      tenant = data;
    }

    // Create new Stripe customer
    const customer = await this.stripe.customers.create({
      name: tenant.name,
      email: tenant.email,
      metadata: {
        tenantId,
      },
    });

    // Save customer ID
    await this.supabase
      .from('subscriptions')
      .update({
        stripe_customer_id: customer.id,
        payment_provider: 'stripe',
      })
      .eq('tenant_id', tenantId);

    return customer.id;
  }

  /**
   * Handle successful payment from Stripe webhook
   */
  async handleSuccessfulPayment(
    sessionId: string,
    paymentIntentId: string,
  ): Promise<void> {
    // Get invoice by checkout session ID
    const { data: invoice } = await this.supabase
      .from('subscription_invoices')
      .select('id, tenant_id, invoice_number, amount_cents')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    if (!invoice) {
      console.error(`Invoice not found for session ${sessionId}`);
      return;
    }

    // Mark invoice as paid
    await this.supabase
      .from('subscription_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq('id', invoice.id);

    // Create payment event for audit log
    await this.supabase
      .from('billing_payment_events')
      .insert({
        tenant_id: invoice.tenant_id,
        event_type: 'payment_completed',
        external_event_id: sessionId,
        amount_cents: invoice.amount_cents,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          paymentIntentId,
        },
      });

    console.log(`✅ Invoice ${invoice.invoice_number} marked as paid`);
  }

  /**
   * Get Stripe customer portal URL (for payment method management)
   */
  async getCustomerPortalUrl(tenantId: string): Promise<string> {
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .single();

    if (!subscription?.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${this.configService.get('APP_URL')}/billing`,
    });

    return session.url;
  }
```

### 2.5 Add Controller Endpoints

**File:** `backend/src/modules/subscription/subscription.controller.ts`

Add these new endpoints:

```typescript
  /**
   * Create Stripe checkout session for an invoice
   */
  @Post('invoices/:id/pay')
  @UseGuards(JwtAuthGuard, BranchGuard)
  async createInvoiceCheckout(
    @Request() req,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.subscriptionService.createCheckoutForInvoice(
      req.branch.tenantId,
      invoiceId,
    );

    return { data: result };
  }

  /**
   * Get Stripe customer portal URL
   */
  @Get('customer-portal')
  @UseGuards(JwtAuthGuard, BranchGuard)
  async getCustomerPortal(@Request() req) {
    const url = await this.subscriptionService.getCustomerPortalUrl(
      req.branch.tenantId,
    );

    return { data: { url } };
  }
```

### 2.6 Create Webhook Controller

**File:** `backend/src/modules/subscription/subscription-webhook.controller.ts`

Create new file:

```typescript
import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionService } from './subscription.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Controller('subscription/webhook')
export class SubscriptionWebhookController {
  private stripe: Stripe;

  constructor(
    private subscriptionService: SubscriptionService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-12-18.acacia',
    });
  }

  @Post()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.warn('⚠️ Webhook secret not configured');
      return { received: true };
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    console.log(`📥 Webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await this.subscriptionService.handleSuccessfulPayment(
          session.id,
          session.payment_intent as string,
        );
        break;

      case 'checkout.session.expired':
        console.log('⏰ Checkout session expired:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
```

### 2.7 Update Module Registration

**File:** `backend/src/modules/subscription/subscription.module.ts`

Update to include webhook controller:

```typescript
import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionWebhookController } from './subscription-webhook.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCron } from './subscription.cron';

@Module({
  controllers: [
    SubscriptionController,
    SubscriptionWebhookController, // Add this
  ],
  providers: [SubscriptionService, SubscriptionCron],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
```

### 2.8 Configure Raw Body Parser

**File:** `backend/src/main.ts`

Update to preserve raw body for webhook verification:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Custom JSON parser to preserve raw body for Stripe webhooks
  app.use(
    json({
      verify: (req: any, res, buf) => {
        // Save raw body for Stripe webhook signature verification
        if (req.url === '/subscription/webhook') {
          req.rawBody = buf;
        }
      },
    }),
  );

  await app.listen(3001);
  console.log('🚀 Backend running on http://localhost:3001');
}
bootstrap();
```

---

## Part 3: Frontend Implementation

### 3.1 Install Stripe.js

```bash
cd frontend
npm install @stripe/stripe-js
```

### 3.2 Environment Variables

**File:** `frontend/.env.local`

Add:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxx
```

### 3.3 Create Stripe Client

**File:** `frontend/src/lib/stripe/client.ts`

Create new file:

```typescript
import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!key) {
      console.error('Stripe publishable key not configured');
      return null;
    }

    stripePromise = loadStripe(key);
  }
  return stripePromise;
};
```

### 3.4 Update API Client

**File:** `frontend/src/lib/api/subscription.ts`

Add these new methods:

```typescript
export const subscriptionApi = {
  // ... existing methods ...

  /**
   * Create Stripe checkout for invoice
   */
  createInvoiceCheckout: (invoiceId: string) =>
    apiClient.post<{ checkoutUrl: string; sessionId: string }>(
      `/subscription/invoices/${invoiceId}/pay`,
    ),

  /**
   * Get Stripe customer portal URL
   */
  getCustomerPortal: () =>
    apiClient.get<{ url: string }>('/subscription/customer-portal'),
};
```

### 3.5 Update Billing Page

**File:** `frontend/src/app/(portal)/billing/page.tsx`

Update your existing billing page:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Container,
  Title,
  Card,
  Table,
  Button,
  Badge,
  Group,
  Text,
  Stack,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconCreditCard, IconDownload } from '@tabler/icons-react';
import { subscriptionApi } from '@/lib/api/subscription';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle payment success/cancel from Stripe redirect
  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');

    if (payment === 'success' && sessionId) {
      notifications.show({
        title: 'Payment Successful',
        message: 'Your invoice has been paid successfully!',
        color: 'green',
      });
      loadInvoices();
      // Clean URL
      router.replace('/billing');
    }

    if (payment === 'cancelled') {
      notifications.show({
        title: 'Payment Cancelled',
        message: 'Payment was cancelled. You can try again anytime.',
        color: 'yellow',
      });
      // Clean URL
      router.replace('/billing');
    }
  }, [searchParams]);

  // Load invoices
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await subscriptionApi.getInvoices();
      setInvoices(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load invoices',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Pay invoice with Stripe
  const handlePayInvoice = async (invoiceId: string) => {
    setPayingInvoice(invoiceId);

    try {
      const { checkoutUrl } = await subscriptionApi.createInvoiceCheckout(invoiceId);
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error: any) {
      notifications.show({
        title: 'Payment Error',
        message: error.message || 'Failed to initiate payment',
        color: 'red',
      });
      setPayingInvoice(null);
    }
  };

  // Download invoice PDF
  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const { url } = await subscriptionApi.downloadInvoice(invoiceId);
      window.open(url, '_blank');
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to download invoice',
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl">
      <Stack spacing="xl">
        {/* Page Header */}
        <div>
          <Title order={1}>Billing</Title>
          <Text color="dimmed" size="sm">
            Manage your subscription and invoices
          </Text>
        </div>

        {/* Billing History */}
        <Card>
          <Group position="apart" mb="md">
            <Title order={3}>Billing History</Title>
          </Group>

          {loading ? (
            <Text>Loading...</Text>
          ) : invoices.length === 0 ? (
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              No invoices yet
            </Alert>
          ) : (
            <Table highlightOnHover>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice: any) => (
                  <tr key={invoice.id}>
                    <td>
                      <Text weight={500}>{invoice.invoice_number}</Text>
                    </td>
                    <td>
                      <Text size="sm">
                        {new Date(invoice.period_start).toLocaleDateString()} -{' '}
                        {new Date(invoice.period_end).toLocaleDateString()}
                      </Text>
                    </td>
                    <td>
                      <Text weight={600}>
                        ${(invoice.amount_cents / 100).toFixed(2)}
                      </Text>
                    </td>
                    <td>
                      <Badge
                        color={
                          invoice.status === 'paid'
                            ? 'green'
                            : invoice.status === 'pending'
                            ? 'yellow'
                            : 'blue'
                        }
                      >
                        {invoice.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm">
                        {invoice.due_date
                          ? new Date(invoice.due_date).toLocaleDateString()
                          : '-'}
                      </Text>
                    </td>
                    <td>
                      <Group spacing="xs">
                        {/* Download PDF */}
                        <Button
                          size="xs"
                          variant="subtle"
                          leftIcon={<IconDownload size={14} />}
                          onClick={() => handleDownloadInvoice(invoice.id)}
                        >
                          Download
                        </Button>

                        {/* Pay with Stripe */}
                        {(invoice.status === 'open' || invoice.status === 'pending') && (
                          <Button
                            size="xs"
                            color="blue"
                            leftIcon={<IconCreditCard size={14} />}
                            loading={payingInvoice === invoice.id}
                            onClick={() => handlePayInvoice(invoice.id)}
                          >
                            Pay Now
                          </Button>
                        )}
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
```

---

## Part 4: Webhook Setup (Return to Stripe Dashboard)

### 4.1 Local Testing with Stripe CLI

For development, use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# Mac:
brew install stripe/stripe-cli/stripe

# Windows:
scoop install stripe

# Linux:
# Download from https://github.com/stripe/stripe-cli/releases

# Login to Stripe
stripe login

# Forward webhooks to your local backend
stripe listen --forward-to localhost:3001/subscription/webhook

# You'll see output like:
# > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy the webhook secret** (`whsec_xxx`) and add to `backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 4.2 Production Webhook Setup

When deploying to production:

1. **Dashboard → Developers → Webhooks**
2. Click **"Add endpoint"**
3. **Endpoint URL:** `https://yourdomain.com/subscription/webhook`
4. **Events to send:**
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add to production environment variables

---

## Part 5: Testing

### 5.1 Test Card Numbers

Use these cards in Stripe Checkout:

```
✅ Success:
Card: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)

❌ Decline:
Card: 4000 0000 0000 0002

🔐 3D Secure Required:
Card: 4000 0025 0000 3155
```

### 5.2 Complete Test Flow

```bash
# 1. Start backend
cd backend
npm run start:dev

# 2. Start Stripe CLI (in new terminal)
stripe listen --forward-to localhost:3001/subscription/webhook

# 3. Start frontend (in new terminal)
cd frontend
npm run dev

# 4. Test the flow:
```

**In Browser:**

1. Open http://localhost:3000/billing
2. You should see your existing invoices
3. Find an invoice with status "OPEN" or "PENDING"
4. Click **"Pay Now"**
5. You'll be redirected to Stripe Checkout
6. Enter test card: `4242 4242 4242 4242`
7. Complete payment
8. You'll be redirected back to /billing with success message
9. Invoice status should be "PAID"

**Check Logs:**

```bash
# Backend logs:
✅ Invoice INV-XXX marked as paid

# Stripe CLI logs:
📥 Webhook received: checkout.session.completed
```

---

## Part 6: Troubleshooting

### Issue: "Webhook signature verification failed"

**Solution:**
```bash
# Make sure Stripe CLI is running
stripe listen --forward-to localhost:3001/subscription/webhook

# Copy the webhook secret it displays
# Update backend/.env with that secret
```

### Issue: "No Stripe customer found"

**Solution:**
```typescript
// The first payment creates the customer automatically
// If error persists, check that subscription table exists
// and has stripe_customer_id column
```

### Issue: Invoice not marked paid after successful payment

**Solution:**
```bash
# Check webhook is receiving events:
stripe listen --forward-to localhost:3001/subscription/webhook

# Check backend logs for errors
# Verify invoice.stripe_checkout_session_id matches webhook session.id
```

### Issue: "Cannot read rawBody"

**Solution:**
```typescript
// Verify main.ts has the json parser with verify function
app.use(
  json({
    verify: (req: any, res, buf) => {
      if (req.url === '/subscription/webhook') {
        req.rawBody = buf;
      }
    },
  }),
);
```

---

## Part 7: Going to Production

### 7.1 Switch to Live Mode

1. **Dashboard** → Toggle "Test mode" OFF (top-left)
2. **Developers → API Keys** → Copy LIVE keys
3. Update production environment:

```env
STRIPE_SECRET_KEY=sk_live_51xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_51xxxxxxxxxxxxx
```

### 7.2 Create Production Webhook

1. **Dashboard → Developers → Webhooks**
2. **Add endpoint** with production URL
3. Copy signing secret
4. Update production env:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 7.3 Test with Real Money

```bash
# Use a real card with small amount first
# Test card that requires 3D Secure:
4000 0025 0000 3155

# This simulates real-world authentication flow
```

---

## Summary - What We Built

```
✅ Backend:
   ├─ Stripe payment processing
   ├─ Webhook handler for payment confirmation
   ├─ Customer creation and management
   └─ Integration with existing invoice system

✅ Frontend:
   ├─ "Pay Now" button on invoices
   ├─ Redirect to Stripe Checkout
   ├─ Success/Cancel handling
   └─ Real-time status updates

✅ No Dashboard Setup:
   ├─ No products created
   ├─ No recurring subscriptions
   ├─ Dynamic pricing in code
   └─ Full control over amounts
```

**Your system calculates everything, Stripe just collects the payment!** 🎉

---

## Quick Reference

### API Endpoints

```
POST /api/v1/subscription/invoices/:id/pay
→ Creates Stripe checkout, returns checkout URL

GET /api/v1/subscription/customer-portal
→ Returns Stripe portal URL for payment methods

POST /subscription/webhook
→ Receives Stripe events (payment completed, etc.)
```

### Test Commands

```bash
# Start Stripe webhook forwarding
stripe listen --forward-to localhost:3001/subscription/webhook

# Trigger test webhook
stripe trigger checkout.session.completed

# View Stripe logs
stripe logs tail
```

### Files Created/Modified

```
backend/
├─ src/modules/subscription/
│  ├─ subscription.service.ts (+ new methods)
│  ├─ subscription.controller.ts (+ new endpoints)
│  ├─ subscription-webhook.controller.ts (NEW)
│  └─ subscription.module.ts (updated)
├─ src/main.ts (updated for raw body)
└─ .env (+ Stripe keys)

frontend/
├─ src/lib/stripe/client.ts (NEW)
├─ src/lib/api/subscription.ts (+ new methods)
├─ src/app/(portal)/billing/page.tsx (updated UI)
└─ .env.local (+ Stripe publishable key)
```

That's it! You're ready to accept payments! 🚀