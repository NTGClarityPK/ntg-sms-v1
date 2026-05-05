-- Term examination flag; optional exam room; due_date supports date+time (idempotent).
ALTER TABLE public.assessment_types
  ADD COLUMN IF NOT EXISTS is_term_examination boolean NOT NULL DEFAULT false;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS room_number text NULL;

-- Migrate DATE -> TIMESTAMPTZ when column is still date (no-op if already timestamptz).
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessments'
      AND column_name = 'due_date'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE public.assessments
      ALTER COLUMN due_date TYPE timestamptz
      USING (CASE WHEN due_date IS NULL THEN NULL ELSE due_date::timestamptz END);
  END IF;
END
$body$;

COMMENT ON COLUMN public.assessment_types.is_term_examination IS 'When true, assessments of this type appear on the examination schedule.';
COMMENT ON COLUMN public.assessments.room_number IS 'Optional venue; only used when the assessment type is a term examination.';
