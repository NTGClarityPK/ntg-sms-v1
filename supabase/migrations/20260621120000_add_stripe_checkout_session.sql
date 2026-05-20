-- Stripe Checkout session tracking per subscription invoice

ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_checkout_session
  ON public.subscription_invoices(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
