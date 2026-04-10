-- Student year placement (enrolments) + end-of-year promotion decisions

-- 1) Student enrolments (placement per academic year)
CREATE TABLE IF NOT EXISTS public.student_enrolments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'graduated', 'transferred_out', 'withdrawn', 'inactive')),
  created_by TEXT NULL,
  updated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_enrolments_student_branch_year
  ON public.student_enrolments(student_id, branch_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_enrolments_branch_year
  ON public.student_enrolments(branch_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_enrolments_branch_year_class_section
  ON public.student_enrolments(branch_id, academic_year_id, class_id, section_id);

ALTER TABLE public.student_enrolments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student enrolments branch isolation" ON public.student_enrolments
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.update_student_enrolments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_enrolments_updated_at ON public.student_enrolments;
CREATE TRIGGER student_enrolments_updated_at
  BEFORE UPDATE ON public.student_enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_enrolments_updated_at();

-- 2) Promotion decisions (recorded for the closing year)
CREATE TABLE IF NOT EXISTS public.student_promotion_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  source_academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('promoted', 'repeated', 'graduated', 'transferred_out', 'withdrawn', 'inactive')),
  target_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  target_section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_promotion_decisions_student_branch_source_year
  ON public.student_promotion_decisions(student_id, branch_id, source_academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_promotion_decisions_branch_source_year
  ON public.student_promotion_decisions(branch_id, source_academic_year_id);

ALTER TABLE public.student_promotion_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student promotion decisions branch isolation" ON public.student_promotion_decisions
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.update_student_promotion_decisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_promotion_decisions_updated_at ON public.student_promotion_decisions;
CREATE TRIGGER student_promotion_decisions_updated_at
  BEFORE UPDATE ON public.student_promotion_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_promotion_decisions_updated_at();

-- 3) Backfill enrolments for existing students where placement exists.
--    This is safe and idempotent (unique index prevents duplicates).
INSERT INTO public.student_enrolments (
  student_id,
  branch_id,
  academic_year_id,
  class_id,
  section_id,
  status,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.branch_id,
  s.academic_year_id,
  s.class_id,
  s.section_id,
  'active',
  NOW(),
  NOW()
FROM public.students s
WHERE s.branch_id IS NOT NULL
  AND s.academic_year_id IS NOT NULL
ON CONFLICT (student_id, branch_id, academic_year_id) DO NOTHING;

