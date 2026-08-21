-- Create library_items table for digital library resources
CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- From system_settings 'library_categories'
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  thumbnail_url TEXT, -- Auto-generated for PDFs
  is_active BOOLEAN DEFAULT TRUE,
  view_count INT DEFAULT 0,
  download_count INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_library_items_branch ON public.library_items(branch_id, category);
CREATE INDEX idx_library_items_subject ON public.library_items(subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX idx_library_items_class ON public.library_items(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_library_items_category ON public.library_items(category);
CREATE INDEX idx_library_items_active ON public.library_items(is_active) WHERE is_active = TRUE;

-- Full-text search index on title, author, description (using GIN for better performance)
CREATE INDEX idx_library_items_search ON public.library_items USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(author, '') || ' ' || coalesce(description, ''))
);

-- Enable RLS
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Branch isolation - users can only see library items from branches they have access to
CREATE POLICY "Library items branch isolation" ON public.library_items
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_library_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER library_items_updated_at
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW
  EXECUTE FUNCTION update_library_items_updated_at();

-- RPC functions for atomic increment of view/download counts
CREATE OR REPLACE FUNCTION increment_library_view_count(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.library_items
  SET view_count = view_count + 1
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_library_download_count(item_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.library_items
  SET download_count = download_count + 1
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
