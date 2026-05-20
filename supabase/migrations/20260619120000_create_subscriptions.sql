-- Subscription and usage tracking per tenant (school)

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL DEFAULT 'free'
    CHECK (plan_id IN ('free', 'starter', 'pro', 'enterprise')),
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'past_due', 'cancelled')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_ends_at TIMESTAMPTZ,
  pending_plan_id VARCHAR(50)
    CHECK (pending_plan_id IS NULL OR pending_plan_id IN ('free', 'starter', 'pro', 'enterprise')),
  pending_billing_cycle VARCHAR(10)
    CHECK (pending_billing_cycle IS NULL OR pending_billing_cycle IN ('monthly', 'yearly')),
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_plan ON public.subscriptions(plan_id);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);

CREATE TABLE public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL UNIQUE REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  branches_used INT NOT NULL DEFAULT 0,
  students_used INT NOT NULL DEFAULT 0,
  staff_used INT NOT NULL DEFAULT 0,
  classes_used INT NOT NULL DEFAULT 0,
  storage_used_mb INT NOT NULL DEFAULT 0,
  reports_this_month INT NOT NULL DEFAULT 0,
  sms_this_month INT NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_usage_subscription ON public.subscription_usage(subscription_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

CREATE TRIGGER subscription_usage_updated_at
  BEFORE UPDATE ON public.subscription_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

-- Bootstrap free subscription on new tenant
CREATE OR REPLACE FUNCTION public.create_free_subscription_for_tenant()
RETURNS TRIGGER AS $$
DECLARE
  sub_id UUID;
BEGIN
  INSERT INTO public.subscriptions (
    tenant_id,
    plan_id,
    billing_cycle,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'free',
    'monthly',
    'active',
    NOW(),
    NOW() + INTERVAL '100 years'
  )
  RETURNING id INTO sub_id;

  INSERT INTO public.subscription_usage (subscription_id)
  VALUES (sub_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_tenant_created_subscription
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_free_subscription_for_tenant();

-- Backfill existing tenants without a subscription
INSERT INTO public.subscriptions (
  tenant_id,
  plan_id,
  billing_cycle,
  status,
  current_period_start,
  current_period_end
)
SELECT
  t.id,
  'free',
  'monthly',
  'active',
  NOW(),
  NOW() + INTERVAL '100 years'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = t.id
);

INSERT INTO public.subscription_usage (subscription_id)
SELECT s.id
FROM public.subscriptions s
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_usage u WHERE u.subscription_id = s.id
);

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_select_policy ON public.subscriptions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT b.tenant_id
      FROM public.user_branches ub
      JOIN public.branches b ON b.id = ub.branch_id
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY subscription_update_policy ON public.subscriptions
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT b.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.branches b ON b.id = ur.branch_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name = 'school_admin'
    )
  );

CREATE POLICY usage_select_policy ON public.subscription_usage
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT s.id
      FROM public.subscriptions s
      WHERE s.tenant_id IN (
        SELECT b.tenant_id
        FROM public.user_branches ub
        JOIN public.branches b ON b.id = ub.branch_id
        WHERE ub.user_id = (SELECT auth.uid())
      )
    )
  );
