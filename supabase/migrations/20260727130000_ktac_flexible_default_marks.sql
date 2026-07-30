-- KTAC category defaults are starting points only (not a fixed official total).
-- Use equal 25-mark defaults so a fresh attach sums to 100; teachers override per assessment.

UPDATE public.rubric_preset_categories rpc
SET default_marks = 25
FROM public.rubric_presets rp
WHERE rpc.preset_id = rp.id
  AND rp.preset_code = 'KTAC'
  AND rp.is_global = true;
