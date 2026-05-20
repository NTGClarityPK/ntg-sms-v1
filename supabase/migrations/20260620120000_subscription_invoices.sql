-- Subscription invoices (manual billing now; Stripe-ready fields)

INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-invoices', 'subscription-invoices', false)
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    public = excluded.public;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (payment_provider IN ('manual', 'stripe')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  invoice_number VARCHAR(64) NOT NULL,
  plan_id VARCHAR(50) NOT NULL
    CHECK (plan_id IN ('free', 'starter', 'pro', 'enterprise')),
  billing_cycle VARCHAR(10) NOT NULL
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  amount_cents INT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  payment_provider VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (payment_provider IN ('manual', 'stripe')),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  hosted_invoice_url TEXT,
  pdf_storage_path TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  idempotency_key VARCHAR(128) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subscription_invoices_number UNIQUE (invoice_number),
  CONSTRAINT uq_subscription_invoices_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_subscription_invoices_tenant ON public.subscription_invoices(tenant_id);
CREATE INDEX idx_subscription_invoices_subscription ON public.subscription_invoices(subscription_id);
CREATE INDEX idx_subscription_invoices_status ON public.subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_issued ON public.subscription_invoices(issued_at DESC);
CREATE INDEX idx_subscription_invoices_stripe ON public.subscription_invoices(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE TABLE public.billing_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('manual', 'stripe')),
  event_type VARCHAR(80) NOT NULL,
  external_event_id VARCHAR(255),
  subscription_invoice_id UUID REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_billing_payment_events_external UNIQUE (provider, external_event_id)
);

CREATE INDEX idx_billing_payment_events_invoice ON public.billing_payment_events(subscription_invoice_id);
CREATE INDEX idx_billing_payment_events_tenant ON public.billing_payment_events(tenant_id);

CREATE OR REPLACE FUNCTION public.set_subscription_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_invoices_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_invoice_updated_at();

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_invoices_select_policy ON public.subscription_invoices
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT b.tenant_id
      FROM public.user_branches ub
      JOIN public.branches b ON b.id = ub.branch_id
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY billing_payment_events_select_policy ON public.billing_payment_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT b.tenant_id
      FROM public.user_branches ub
      JOIN public.branches b ON b.id = ub.branch_id
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );
