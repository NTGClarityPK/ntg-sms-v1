-- Taxonomy + delivery (see results module revamp plan)
ALTER TABLE public.result_cards
  ADD COLUMN IF NOT EXISTS report_kind text NOT NULL DEFAULT 'term_report',
  ADD COLUMN IF NOT EXISTS term_phase text,
  ADD COLUMN IF NOT EXISTS progress_sequence integer;

UPDATE public.result_cards
SET term_phase = result_type
WHERE term_phase IS NULL AND report_kind = 'term_report';

ALTER TABLE public.result_cards DROP CONSTRAINT IF EXISTS result_cards_student_id_class_section_id_academic_year_id_r_key;

CREATE UNIQUE INDEX IF NOT EXISTS result_cards_term_report_unique
  ON public.result_cards (student_id, class_section_id, academic_year_id, term_phase)
  WHERE report_kind = 'term_report' AND term_phase IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS result_cards_annual_report_unique
  ON public.result_cards (student_id, class_section_id, academic_year_id)
  WHERE report_kind = 'annual_report';

CREATE UNIQUE INDEX IF NOT EXISTS result_cards_progress_report_seq_unique
  ON public.result_cards (student_id, class_section_id, academic_year_id, progress_sequence)
  WHERE report_kind = 'progress_report' AND progress_sequence IS NOT NULL;

ALTER TABLE public.result_cards
  DROP CONSTRAINT IF EXISTS result_cards_report_kind_check;

ALTER TABLE public.result_cards
  ADD CONSTRAINT result_cards_report_kind_check
  CHECK (report_kind IN ('term_report', 'annual_report', 'progress_report'));

ALTER TABLE public.result_cards
  DROP CONSTRAINT IF EXISTS result_cards_term_phase_when_term_check;

ALTER TABLE public.result_cards
  ADD CONSTRAINT result_cards_term_phase_when_term_check
  CHECK (
    report_kind <> 'term_report'
    OR (term_phase IS NOT NULL AND term_phase IN ('interim', 'mid_term', 'final'))
  );

CREATE TABLE IF NOT EXISTS public.result_card_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_card_id uuid NOT NULL REFERENCES public.result_cards(id) ON DELETE CASCADE,
  recipient_type text,
  recipient_id uuid,
  recipient_contact text,
  delivery_method text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending',
  delivered_at timestamptz,
  delivered_by uuid,
  opened_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_result_card_deliveries_card
  ON public.result_card_deliveries(result_card_id);
