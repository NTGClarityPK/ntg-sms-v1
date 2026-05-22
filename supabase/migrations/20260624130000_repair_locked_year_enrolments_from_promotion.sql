-- Repair: align locked/closing-year student_enrolments with student_promotion_decisions
-- (fixes legacy drift e.g. promoted to Class II but 2026-2027 enrolment still Class I).

UPDATE public.student_enrolments e
SET
  class_id = spd.target_class_id,
  section_id = spd.target_section_id,
  status = 'active',
  updated_at = NOW()
FROM public.student_promotion_decisions spd
WHERE e.student_id = spd.student_id
  AND e.branch_id = spd.branch_id
  AND e.academic_year_id = spd.source_academic_year_id
  AND spd.outcome IN ('promoted', 'repeated')
  AND (
    e.class_id IS DISTINCT FROM spd.target_class_id
    OR e.section_id IS DISTINCT FROM spd.target_section_id
    OR e.status IS DISTINCT FROM 'active'
  );

UPDATE public.student_enrolments e
SET
  class_id = NULL,
  section_id = NULL,
  status = spd.outcome,
  updated_at = NOW()
FROM public.student_promotion_decisions spd
WHERE e.student_id = spd.student_id
  AND e.branch_id = spd.branch_id
  AND e.academic_year_id = spd.source_academic_year_id
  AND spd.outcome NOT IN ('promoted', 'repeated')
  AND (
    e.class_id IS NOT NULL
    OR e.section_id IS NOT NULL
    OR e.status IS DISTINCT FROM spd.outcome
  );
