ALTER TABLE public.id_cards
  ADD COLUMN IF NOT EXISTS design_variant TEXT NOT NULL DEFAULT 'modern'
  CHECK (design_variant IN ('classic', 'modern', 'minimal'));
