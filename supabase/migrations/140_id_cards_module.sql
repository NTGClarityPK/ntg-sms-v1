-- ID Card Generation module (branch-scoped)

insert into storage.buckets (id, name, public)
values ('id-card-assets', 'id-card-assets', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

CREATE TABLE public.id_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('student', 'staff', 'admin', 'visitor')),
  card_side TEXT NOT NULL CHECK (card_side IN ('front', 'back')),
  html_template_key TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{"width": 85.6, "height": 54, "unit": "mm"}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_id_card_templates_branch_role_side_key
  ON public.id_card_templates(branch_id, role_type, card_side, html_template_key);
CREATE INDEX idx_id_card_templates_branch_role ON public.id_card_templates(branch_id, role_type, is_active);

CREATE TABLE public.id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('student', 'staff', 'admin', 'visitor')),
  card_number TEXT NOT NULL,
  template_id UUID REFERENCES public.id_card_templates(id) ON DELETE SET NULL,
  photo_url TEXT,
  qr_payload TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'printed', 'issued', 'revoked')),
  valid_from DATE,
  valid_until DATE,
  print_count INT NOT NULL DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  front_pdf_path TEXT,
  back_pdf_path TEXT,
  is_reissued BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_id_cards_branch_card_number ON public.id_cards(branch_id, card_number);
CREATE INDEX idx_id_cards_branch_person ON public.id_cards(branch_id, person_type, person_id);
CREATE INDEX idx_id_cards_branch_status ON public.id_cards(branch_id, status);

CREATE TABLE public.id_card_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('student', 'staff', 'admin', 'visitor')),
  original_url TEXT,
  processed_url TEXT,
  face_detected BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_id_card_photos_branch_person ON public.id_card_photos(branch_id, person_type, person_id);

CREATE TABLE public.id_card_reprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.id_cards(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fee_charged NUMERIC(10, 2),
  printed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_id_card_reprints_card ON public.id_card_reprints(card_id);
CREATE INDEX idx_id_card_reprints_branch ON public.id_card_reprints(branch_id);

CREATE TABLE public.id_card_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_count INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_id_card_generation_jobs_branch_status ON public.id_card_generation_jobs(branch_id, status);

ALTER TABLE public.id_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_card_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_card_reprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_card_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY id_card_templates_branch_isolation ON public.id_card_templates
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY id_cards_branch_isolation ON public.id_cards
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY id_card_photos_branch_isolation ON public.id_card_photos
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY id_card_reprints_branch_isolation ON public.id_card_reprints
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY id_card_generation_jobs_branch_isolation ON public.id_card_generation_jobs
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

insert into public.features (code, name)
values ('id_cards', 'ID Cards')
on conflict (code) do update
set name = excluded.name;
