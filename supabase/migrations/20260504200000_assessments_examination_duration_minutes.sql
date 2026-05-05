-- Term examinations: store duration in minutes; exam end = due_date (start) + duration (derived in app).
-- Nullable: non–term-examination assessments leave this null.

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS examination_duration_minutes integer NULL;

COMMENT ON COLUMN public.assessments.examination_duration_minutes IS
  'Positive duration in minutes when assessment type is term examination; null otherwise. End time = due_date + duration.';

ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_examination_duration_minutes_positive;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_examination_duration_minutes_positive CHECK (
    examination_duration_minutes IS NULL OR examination_duration_minutes >= 1
  );
