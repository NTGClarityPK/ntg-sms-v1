-- Fee Management module schema (branch-scoped)

-- Buckets for challans/receipts/proofs
insert into storage.buckets (id, name, public)
values ('fee-documents', 'fee-documents', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- Templates
CREATE TABLE public.fee_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Fee', 'Discount')),
  scope TEXT NOT NULL CHECK (scope IN ('Levels', 'Class', 'Class-Section', 'Individual')),
  auto_apply BOOLEAN NOT NULL DEFAULT FALSE,
  auto_apply_condition JSONB,
  days_until_due INT NOT NULL DEFAULT 30 CHECK (days_until_due BETWEEN 1 AND 365),
  pro_rate_type TEXT NOT NULL DEFAULT 'Full_Month' CHECK (pro_rate_type IN ('Full_Month', 'Half_Month', 'Daily_Pro_Rate')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_templates_branch_name ON public.fee_templates(branch_id, name);
CREATE INDEX idx_fee_templates_branch_active ON public.fee_templates(branch_id, is_active);
CREATE INDEX idx_fee_templates_branch_scope ON public.fee_templates(branch_id, scope);

-- Template metrics (line items)
CREATE TABLE public.fee_template_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.fee_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_type TEXT NOT NULL CHECK (amount_type IN ('Absolute', 'Percentage')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  per_day BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_template_metrics_template ON public.fee_template_metrics(template_id);

-- Assign templates to scopes (polymorphic target id)
CREATE TABLE public.fee_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.fee_templates(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('Level', 'Class', 'Section')),
  scope_id UUID NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_template_assignments_template_scope ON public.fee_template_assignments(template_id, scope_type, scope_id);
CREATE INDEX idx_fee_template_assignments_branch_scope ON public.fee_template_assignments(branch_id, scope_type, scope_id);
CREATE INDEX idx_fee_template_assignments_template ON public.fee_template_assignments(template_id);

-- Link individual templates to student (optional date range for pro-rate)
CREATE TABLE public.fee_student_template_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.fee_templates(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_student_template_links_student_template ON public.fee_student_template_links(student_id, template_id);
CREATE INDEX idx_fee_student_template_links_student_active ON public.fee_student_template_links(student_id, is_active);
CREATE INDEX idx_fee_student_template_links_branch_student ON public.fee_student_template_links(branch_id, student_id);

-- Exclude a specific metric for a student
CREATE TABLE public.fee_metric_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.fee_templates(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES public.fee_template_metrics(id) ON DELETE CASCADE,
  excluded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_metric_exclusions_student_metric ON public.fee_metric_exclusions(student_id, metric_id);
CREATE INDEX idx_fee_metric_exclusions_student ON public.fee_metric_exclusions(student_id);
CREATE INDEX idx_fee_metric_exclusions_branch_student ON public.fee_metric_exclusions(branch_id, student_id);

-- Challans
CREATE TABLE public.fee_challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  challan_number TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  months_included TEXT[],
  generation_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  total_discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
  payable_amount NUMERIC(10,2) NOT NULL CHECK (payable_amount >= 0),
  status TEXT NOT NULL DEFAULT 'Pending_Payment' CHECK (status IN ('Pending_Payment', 'Under_Review', 'Verified', 'Rejected', 'Cancelled')),
  pdf_url TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_challans_branch_number ON public.fee_challans(branch_id, challan_number);
CREATE INDEX idx_fee_challans_branch_student_month ON public.fee_challans(branch_id, student_id, month);
CREATE INDEX idx_fee_challans_branch_status ON public.fee_challans(branch_id, status);
CREATE INDEX idx_fee_challans_due_date ON public.fee_challans(due_date, branch_id);

-- Line items (expanded per month when multi-month)
CREATE TABLE public.fee_challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.fee_challans(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.fee_templates(id) ON DELETE RESTRICT,
  metric_id UUID REFERENCES public.fee_template_metrics(id) ON DELETE SET NULL,
  billing_month TEXT CHECK (billing_month IS NULL OR billing_month ~ '^[0-9]{4}-[0-9]{2}$'),
  description TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('Fee', 'Discount')),
  amount NUMERIC(10,2) NOT NULL,
  is_discount BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_challan_items_challan ON public.fee_challan_items(challan_id);
CREATE INDEX idx_fee_challan_items_template ON public.fee_challan_items(template_id);

-- Payments
CREATE TABLE public.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.fee_challans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0),
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Bank_Transfer', 'Cash', 'Online', 'Cheque')),
  transaction_reference TEXT,
  bank_name TEXT,
  proof_document_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending_Review' CHECK (status IN ('Pending_Review', 'Verified', 'Rejected')),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_payments_branch_status ON public.fee_payments(branch_id, status);
CREATE INDEX idx_fee_payments_challan ON public.fee_payments(challan_id);
CREATE INDEX idx_fee_payments_student ON public.fee_payments(student_id);

-- Late fee applications
CREATE TABLE public.fee_late_fee_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.fee_challans(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.fee_templates(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  applied_automatically BOOLEAN NOT NULL DEFAULT TRUE,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  days_overdue INT,
  can_be_waived BOOLEAN NOT NULL DEFAULT TRUE,
  waived BOOLEAN NOT NULL DEFAULT FALSE,
  waived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  waived_at TIMESTAMPTZ,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_late_fee_applications_challan ON public.fee_late_fee_applications(challan_id);
CREATE INDEX idx_fee_late_fee_applications_branch_created ON public.fee_late_fee_applications(branch_id, created_at);

-- Covered months for multi-month verified challans
CREATE TABLE public.fee_challan_month_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.fee_challans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_fee_challan_month_coverage_student_month ON public.fee_challan_month_coverage(student_id, month);
CREATE INDEX idx_fee_challan_month_coverage_branch_month ON public.fee_challan_month_coverage(branch_id, month);

-- RLS
ALTER TABLE public.fee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_template_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_template_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_student_template_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_metric_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_late_fee_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_challan_month_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fee templates branch isolation" ON public.fee_templates
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee template metrics via template" ON public.fee_template_metrics
  FOR ALL USING (
    template_id IN (
      SELECT id FROM public.fee_templates t
      WHERE t.branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Fee template assignments branch isolation" ON public.fee_template_assignments
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee student template links branch isolation" ON public.fee_student_template_links
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee metric exclusions branch isolation" ON public.fee_metric_exclusions
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee challans branch isolation" ON public.fee_challans
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee challan items via challan" ON public.fee_challan_items
  FOR ALL USING (
    challan_id IN (
      SELECT id FROM public.fee_challans c
      WHERE c.branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Fee payments branch isolation" ON public.fee_payments
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee late fee applications branch isolation" ON public.fee_late_fee_applications
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Fee challan month coverage branch isolation" ON public.fee_challan_month_coverage
  FOR ALL USING (
    branch_id IN (SELECT branch_id FROM public.user_branches WHERE user_id = (SELECT auth.uid()))
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_fee_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fee_templates_updated_at ON public.fee_templates;
CREATE TRIGGER fee_templates_updated_at
  BEFORE UPDATE ON public.fee_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_fee_templates_updated_at();

CREATE OR REPLACE FUNCTION update_fee_student_template_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fee_student_template_links_updated_at ON public.fee_student_template_links;
CREATE TRIGGER fee_student_template_links_updated_at
  BEFORE UPDATE ON public.fee_student_template_links
  FOR EACH ROW
  EXECUTE FUNCTION update_fee_student_template_links_updated_at();

CREATE OR REPLACE FUNCTION update_fee_challans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fee_challans_updated_at ON public.fee_challans;
CREATE TRIGGER fee_challans_updated_at
  BEFORE UPDATE ON public.fee_challans
  FOR EACH ROW
  EXECUTE FUNCTION update_fee_challans_updated_at();

CREATE OR REPLACE FUNCTION update_fee_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fee_payments_updated_at ON public.fee_payments;
CREATE TRIGGER fee_payments_updated_at
  BEFORE UPDATE ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_fee_payments_updated_at();

