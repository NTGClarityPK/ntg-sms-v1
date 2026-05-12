-- Add optional billing period dates to challans.
-- Used for displaying a custom billing period on the generated challan PDF.

ALTER TABLE public.fee_challans
  ADD COLUMN IF NOT EXISTS billing_start_date DATE,
  ADD COLUMN IF NOT EXISTS billing_end_date DATE;

-- Optional sanity: if one is set, the other should be set too.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fee_challans_billing_period_pair_chk'
  ) THEN
    ALTER TABLE public.fee_challans
      ADD CONSTRAINT fee_challans_billing_period_pair_chk
      CHECK (
        (billing_start_date IS NULL AND billing_end_date IS NULL)
        OR (billing_start_date IS NOT NULL AND billing_end_date IS NOT NULL)
      );
  END IF;
END $$;

