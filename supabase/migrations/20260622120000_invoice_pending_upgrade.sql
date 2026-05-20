-- Link open invoices to a plan upgrade that completes only after payment

ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS pending_upgrade_plan_id VARCHAR(50)
    CHECK (pending_upgrade_plan_id IS NULL OR pending_upgrade_plan_id IN ('free', 'starter', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS pending_upgrade_billing_cycle VARCHAR(10)
    CHECK (pending_upgrade_billing_cycle IS NULL OR pending_upgrade_billing_cycle IN ('monthly', 'yearly'));

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_pending_upgrade
  ON public.subscription_invoices(tenant_id, status)
  WHERE pending_upgrade_plan_id IS NOT NULL AND status = 'open';
