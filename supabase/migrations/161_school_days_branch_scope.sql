-- Scope school_days to branch (was global — cross-tenant leak).
-- Applied via Supabase MCP as school_days_branch_scope; kept in-repo for deploy parity.
-- Also patches commit_setup_wizard + copy_settings_from_branch (see companion notes below).

ALTER TABLE public.school_days
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.school_days DROP CONSTRAINT IF EXISTS school_days_day_of_week_unique;
ALTER TABLE public.school_days DROP CONSTRAINT IF EXISTS school_days_day_of_week_uq;
DROP INDEX IF EXISTS public.school_days_day_of_week_unique;
DROP INDEX IF EXISTS public.school_days_day_of_week_uq;

DELETE FROM public.school_days WHERE branch_id IS NULL;

-- Default Mon-Fri (1-5) for existing branches. Demo tenants may override after seed.
INSERT INTO public.school_days (day_of_week, is_active, branch_id, tenant_id)
SELECT
  d.day_of_week,
  (d.day_of_week BETWEEN 1 AND 5) AS is_active,
  b.id,
  b.tenant_id
FROM public.branches b
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_days sd
  WHERE sd.branch_id = b.id AND sd.day_of_week = d.day_of_week
);

ALTER TABLE public.school_days
  ALTER COLUMN branch_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS school_days_branch_day_uq
  ON public.school_days (branch_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_school_days_branch_id ON public.school_days (branch_id);
CREATE INDEX IF NOT EXISTS idx_school_days_tenant_id ON public.school_days (tenant_id);

ALTER TABLE public.school_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branch_isolation_school_days_select ON public.school_days;
DROP POLICY IF EXISTS branch_isolation_school_days_insert ON public.school_days;
DROP POLICY IF EXISTS branch_isolation_school_days_update ON public.school_days;
DROP POLICY IF EXISTS branch_isolation_school_days_delete ON public.school_days;

CREATE POLICY branch_isolation_school_days_select ON public.school_days
  FOR SELECT USING (
    branch_id IN (
      SELECT ub.branch_id FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY branch_isolation_school_days_insert ON public.school_days
  FOR INSERT WITH CHECK (
    branch_id IN (
      SELECT ub.branch_id FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY branch_isolation_school_days_update ON public.school_days
  FOR UPDATE USING (
    branch_id IN (
      SELECT ub.branch_id FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    branch_id IN (
      SELECT ub.branch_id FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY branch_isolation_school_days_delete ON public.school_days
  FOR DELETE USING (
    branch_id IN (
      SELECT ub.branch_id FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

-- NOTE: After this migration, update RPCs in the remote DB (already applied on production/dev via MCP):
-- 1) commit_setup_wizard: insert/update school_days with branch_id + tenant_id,
--    ON CONFLICT (branch_id, day_of_week), filter updates by branch_id.
-- 2) copy_settings_from_branch: copy school_days from source to target branch.
