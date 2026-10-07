-- Enterprise offer + live snapshot + watermarks on subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS enterprise_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enterprise_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enterprise_branches_limit INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_students_limit INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_storage_gb_limit NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS enterprise_fees_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_library_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_behavioural_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_uniform_inventory_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_white_label_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_google_classroom_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS enterprise_fees_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_library_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_behavioural_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_uniform_inventory_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_white_label_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_google_classroom_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS enterprise_paid_trial_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enterprise_paid_trial_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS enterprise_pre_trial_setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enterprise_post_trial_setup_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enterprise_in_paid_trial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enterprise_access_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enterprise_trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enterprise_prorate_backdated_access BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_enterprise_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_branches_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_students_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_enterprise_storage_gb_limit NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS current_enterprise_fees_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_library_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_behavioural_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_uniform_inventory_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_white_label_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_google_classroom_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS current_enterprise_fees_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_library_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_behavioural_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_uniform_inventory_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_white_label_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_enterprise_google_classroom_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS access_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_fee_paid_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_subscription_start_date DATE;

-- Assessments creation lock on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS assessments_creation_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assessments_creation_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assessments_creation_lock_reason TEXT;

-- Admin API hits log (service-role writes)
CREATE TABLE IF NOT EXISTS public.api_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  method VARCHAR(16) NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  action_type VARCHAR(80),
  request_body JSONB,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_hits_created_at ON public.api_hits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_hits_tenant ON public.api_hits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_hits_status ON public.api_hits(status_code);
CREATE INDEX IF NOT EXISTS idx_api_hits_method ON public.api_hits(method);

ALTER TABLE public.api_hits ENABLE ROW LEVEL SECURITY;

-- Backfill existing Enterprise tenants so they keep entitlements under snapshot model
UPDATE public.subscriptions
SET
  current_enterprise_price = COALESCE(current_enterprise_price, 1),
  current_enterprise_duration_months = COALESCE(current_enterprise_duration_months, 12),
  current_enterprise_fees_enabled = COALESCE(current_enterprise_fees_enabled, true),
  current_enterprise_library_enabled = COALESCE(current_enterprise_library_enabled, true),
  current_enterprise_behavioural_enabled = COALESCE(current_enterprise_behavioural_enabled, true),
  current_enterprise_uniform_inventory_enabled = COALESCE(current_enterprise_uniform_inventory_enabled, true),
  current_enterprise_white_label_enabled = COALESCE(current_enterprise_white_label_enabled, true),
  current_enterprise_google_classroom_enabled = COALESCE(current_enterprise_google_classroom_enabled, true),
  first_subscription_start_date = COALESCE(first_subscription_start_date, current_period_start::date)
WHERE plan_id = 'enterprise'
  AND current_enterprise_price IS NULL;
