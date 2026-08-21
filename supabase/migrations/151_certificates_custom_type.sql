-- Add custom award certificate type
ALTER TABLE public.certificates
  DROP CONSTRAINT IF EXISTS certificates_certificate_type_check;

ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_certificate_type_check
  CHECK (
    certificate_type IN (
      'sports',
      'academic',
      'promotion',
      'participation',
      'leaving',
      'character',
      'custom'
    )
  );
