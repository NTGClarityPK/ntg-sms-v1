-- Per certificate-type signature line labels (branch settings)
ALTER TABLE public.certificate_settings
  ADD COLUMN IF NOT EXISTS signature_labels_by_type JSONB NOT NULL DEFAULT '{}'::jsonb;
