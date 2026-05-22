-- One-time alignment: mirror active-year active enrolments onto students (class/section/academic_year_id).
-- Safe to re-run: only updates rows where placement differs.

UPDATE public.students s
SET
  class_id = e.class_id,
  section_id = e.section_id,
  academic_year_id = e.academic_year_id,
  updated_at = NOW()
FROM public.student_enrolments e
INNER JOIN public.academic_years ay ON ay.id = e.academic_year_id
WHERE s.id = e.student_id
  AND s.branch_id = e.branch_id
  AND e.status = 'active'
  AND ay.is_active = true
  AND ay.is_locked = false
  AND (
    s.class_id IS DISTINCT FROM e.class_id
    OR s.section_id IS DISTINCT FROM e.section_id
    OR s.academic_year_id IS DISTINCT FROM e.academic_year_id
  );

-- Backfill missing enrolments from students who are on the active year (legacy-only placement).
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
  CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END,
  NOW(),
  NOW()
FROM public.students s
INNER JOIN public.academic_years ay ON ay.id = s.academic_year_id
WHERE s.academic_year_id IS NOT NULL
  AND s.class_id IS NOT NULL
  AND s.section_id IS NOT NULL
  AND ay.is_active = true
  AND ay.is_locked = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_enrolments e
    WHERE e.student_id = s.id
      AND e.branch_id = s.branch_id
      AND e.academic_year_id = s.academic_year_id
  )
ON CONFLICT (student_id, branch_id, academic_year_id) DO NOTHING;
