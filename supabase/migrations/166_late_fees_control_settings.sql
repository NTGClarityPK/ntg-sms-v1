-- Late fees control: persist waive reason + branch late-fee settings

ALTER TABLE public.fee_late_fee_applications
  ADD COLUMN IF NOT EXISTS waived_reason TEXT NULL;

ALTER TABLE public.fee_challan_settings
  ADD COLUMN IF NOT EXISTS late_fees_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_fee_template_id UUID NULL REFERENCES public.fee_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fee_challan_settings_late_fee_template
  ON public.fee_challan_settings(late_fee_template_id)
  WHERE late_fee_template_id IS NOT NULL;
