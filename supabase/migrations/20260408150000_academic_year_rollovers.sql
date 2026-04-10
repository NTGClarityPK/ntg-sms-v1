-- Track one-time rollover completion per target academic year (per branch)

CREATE TABLE IF NOT EXISTS public.academic_year_rollovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  source_academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  target_academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  carry_forward JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure rollover is allowed only once per target year for a branch
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_year_rollovers_branch_target
  ON public.academic_year_rollovers(branch_id, target_academic_year_id);

CREATE INDEX IF NOT EXISTS idx_academic_year_rollovers_branch_target
  ON public.academic_year_rollovers(branch_id, target_academic_year_id);

ALTER TABLE public.academic_year_rollovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Academic year rollovers branch isolation" ON public.academic_year_rollovers
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

