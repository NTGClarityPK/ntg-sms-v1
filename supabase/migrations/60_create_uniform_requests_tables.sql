-- uniform_requests and uniform_request_items (enum uniform_request_status already exists)
CREATE TABLE public.uniform_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status uniform_request_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.uniform_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.uniform_requests(id) ON DELETE CASCADE,
  uniform_item_id UUID NOT NULL REFERENCES public.uniform_items(id) ON DELETE RESTRICT,
  size TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uniform_requests_student ON public.uniform_requests(student_id);
CREATE INDEX idx_uniform_requests_status ON public.uniform_requests(status, branch_id);
CREATE INDEX idx_uniform_requests_branch ON public.uniform_requests(branch_id);
CREATE INDEX idx_uniform_requests_requested_by ON public.uniform_requests(requested_by);
CREATE INDEX idx_uniform_request_items_request ON public.uniform_request_items(request_id);

ALTER TABLE public.uniform_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uniform requests branch isolation" ON public.uniform_requests
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
  );

CREATE POLICY "Uniform request items via request" ON public.uniform_request_items
  FOR ALL USING (
    request_id IN (
      SELECT id FROM public.uniform_requests ur
      WHERE ur.branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
    )
  );
