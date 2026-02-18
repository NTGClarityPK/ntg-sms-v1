-- Enum for uniform request status (used in Phase 12.2)
CREATE TYPE uniform_request_status AS ENUM ('pending', 'approved', 'rejected', 'issued', 'cancelled');

-- Uniform items (branch-scoped)
CREATE TABLE public.uniform_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  item_code TEXT,
  category TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'unisex')),
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock per item/size
CREATE TABLE public.uniform_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uniform_item_id UUID NOT NULL REFERENCES public.uniform_items(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(uniform_item_id, size, branch_id)
);

CREATE INDEX idx_uniform_items_branch ON public.uniform_items(branch_id);
CREATE INDEX idx_uniform_stock_item ON public.uniform_stock(uniform_item_id);
CREATE INDEX idx_uniform_stock_branch ON public.uniform_stock(branch_id);

ALTER TABLE public.uniform_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uniform items branch isolation" ON public.uniform_items
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
  );

CREATE POLICY "Uniform stock branch isolation" ON public.uniform_stock
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION update_uniform_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uniform_items_updated_at
  BEFORE UPDATE ON public.uniform_items
  FOR EACH ROW
  EXECUTE PROCEDURE update_uniform_items_updated_at();
