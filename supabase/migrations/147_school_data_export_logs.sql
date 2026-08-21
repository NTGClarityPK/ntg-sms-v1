-- School data export audit and rate limiting (Phase 1 manual backup)
CREATE TABLE IF NOT EXISTS public.school_data_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('tenant', 'branch')),
  export_type TEXT NOT NULL DEFAULT 'manual' CHECK (export_type IN ('manual')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  file_size_bytes BIGINT,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_data_export_logs_tenant_created
  ON public.school_data_export_logs (tenant_id, created_at DESC);

CREATE INDEX idx_school_data_export_logs_tenant_success_recent
  ON public.school_data_export_logs (tenant_id, created_at DESC)
  WHERE status = 'success';

COMMENT ON TABLE public.school_data_export_logs IS 'Manual school data export attempts; rate limit: 1 success per tenant per 24h';

ALTER TABLE public.school_data_export_logs ENABLE ROW LEVEL SECURITY;

-- Backend uses service role; no client policies required for Phase 1

-- Column list for export (excludes sensitive field names)
CREATE OR REPLACE FUNCTION public.get_exportable_columns(p_table text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(column_name::text ORDER BY ordinal_position),
    ARRAY[]::text[]
  )
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table
    AND lower(column_name) NOT IN (
      'password', 'password_hash', 'hashed_password', 'pin_hash', 'pin',
      'token', 'refresh_token', 'access_token', 'api_key', 'secret',
      'client_secret', 'stripe_secret_key', 'stripe_webhook_secret',
      'mfa_secret', 'otp_secret', 'invitation_token', 'reset_token',
      'session_token', 'private_key', 'vapid_private_key', 'vapid_public_key',
      'encrypted_password',
      'public_stats_password'
    );
$$;
