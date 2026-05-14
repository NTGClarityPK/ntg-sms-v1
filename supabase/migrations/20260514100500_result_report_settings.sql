CREATE TABLE IF NOT EXISTS public.result_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  pdf_variant text NOT NULL DEFAULT 'modern',
  progress_max_assessments integer,
  progress_window_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT result_report_settings_branch_unique UNIQUE (branch_id),
  CONSTRAINT result_report_settings_pdf_variant_check
    CHECK (pdf_variant IN ('minimal', 'modern'))
);

CREATE INDEX IF NOT EXISTS idx_result_report_settings_branch
  ON public.result_report_settings(branch_id);
