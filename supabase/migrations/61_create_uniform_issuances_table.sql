CREATE TABLE public.uniform_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uniform_item_id UUID NOT NULL REFERENCES public.uniform_items(id) ON DELETE RESTRICT,
  size TEXT NOT NULL,
  quantity INT NOT NULL,
  issued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id UUID REFERENCES public.uniform_requests(id) ON DELETE SET NULL,
  notes TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uniform_issuances_student ON public.uniform_issuances(student_id);
CREATE INDEX idx_uniform_issuances_branch ON public.uniform_issuances(branch_id);
CREATE INDEX idx_uniform_issuances_issued_at ON public.uniform_issuances(issued_at);
CREATE INDEX idx_uniform_issuances_item ON public.uniform_issuances(uniform_item_id);

ALTER TABLE public.uniform_issuances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uniform issuances branch isolation" ON public.uniform_issuances
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = auth.uid())
  );
