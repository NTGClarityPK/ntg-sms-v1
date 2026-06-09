-- Teacher substitution assignments (branch-scoped)

CREATE TABLE public.teacher_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  absent_teacher_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  substitute_teacher_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  absence_date DATE NOT NULL,
  absence_reason TEXT NOT NULL CHECK (
    absence_reason IN ('sick_leave', 'casual_leave', 'emergency', 'other')
  ),
  timetable_slot_id UUID NOT NULL REFERENCES public.timetable_slots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'completed', 'cancelled')
  ),
  notified_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_substitutions_branch_id ON public.teacher_substitutions(branch_id);
CREATE INDEX idx_teacher_substitutions_absence_date ON public.teacher_substitutions(absence_date);
CREATE INDEX idx_teacher_substitutions_substitute_teacher_id ON public.teacher_substitutions(substitute_teacher_id);
CREATE INDEX idx_teacher_substitutions_branch_absence_date ON public.teacher_substitutions(branch_id, absence_date DESC);
CREATE INDEX idx_teacher_substitutions_absent_date ON public.teacher_substitutions(absent_teacher_id, absence_date);

CREATE UNIQUE INDEX uq_teacher_substitutions_slot_date_active
  ON public.teacher_substitutions(timetable_slot_id, absence_date)
  WHERE status <> 'cancelled';

ALTER TABLE public.teacher_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_substitutions_branch_isolation ON public.teacher_substitutions
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

INSERT INTO public.features (code, name)
VALUES ('teacher_substitution', 'Teacher Substitution')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

-- Backfill permissions for existing branches
INSERT INTO public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
SELECT
  r.id,
  f.id,
  CASE
    WHEN r.name IN ('school_admin', 'principal', 'academic_coordinator') THEN 'edit'
    WHEN r.name IN ('subject_teacher', 'class_teacher') THEN 'view'
    ELSE 'none'
  END,
  b.id,
  now(),
  'migration',
  'migration'
FROM public.roles r
CROSS JOIN public.features f
CROSS JOIN public.branches b
WHERE f.code = 'teacher_substitution'
  AND r.name IN (
    'school_admin',
    'principal',
    'academic_coordinator',
    'subject_teacher',
    'class_teacher'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.feature_id = f.id
      AND rp.branch_id = b.id
  );
