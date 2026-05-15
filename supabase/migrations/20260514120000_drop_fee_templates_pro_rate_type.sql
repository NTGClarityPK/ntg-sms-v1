-- Fee templates: full-month billing only — remove pro_rate_type.
-- Normalise metrics so amounts are interpreted as full-month line items.

UPDATE public.fee_template_metrics AS m
SET per_day = false
FROM public.fee_templates AS t
WHERE m.template_id = t.id
  AND (t.pro_rate_type IN ('Half_Month', 'Daily_Pro_Rate') OR m.per_day = true);

UPDATE public.fee_templates
SET pro_rate_type = 'Full_Month'
WHERE pro_rate_type IN ('Half_Month', 'Daily_Pro_Rate');

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
    AND rel.relname = 'fee_templates'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%pro_rate_type%'
  LIMIT 1;
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.fee_templates DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.fee_templates DROP COLUMN IF EXISTS pro_rate_type;
