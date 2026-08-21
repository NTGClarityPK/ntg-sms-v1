-- Certificate Generation module (branch-scoped)

insert into storage.buckets (id, name, public)
values ('certificate-documents', 'certificate-documents', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

CREATE TABLE public.certificate_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  school_logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#537D5D',
  school_tagline TEXT,
  principal_name TEXT,
  registrar_name TEXT,
  school_established TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_certificate_settings_branch UNIQUE (branch_id)
);

CREATE TABLE public.certificate_number_counters (
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  year INT NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (branch_id, year)
);

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  certificate_type TEXT NOT NULL CHECK (
    certificate_type IN ('sports', 'academic', 'promotion', 'participation', 'leaving', 'character')
  ),
  template_id TEXT NOT NULL CHECK (template_id IN ('award', 'administrative')),
  certificate_number TEXT NOT NULL,
  certificate_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_certificates_branch_number
  ON public.certificates(branch_id, certificate_number);
CREATE INDEX idx_certificates_branch_student
  ON public.certificates(branch_id, student_id);
CREATE INDEX idx_certificates_branch_type
  ON public.certificates(branch_id, certificate_type);
CREATE INDEX idx_certificates_branch_issued_at
  ON public.certificates(branch_id, issued_at DESC);
CREATE INDEX idx_certificates_branch_status
  ON public.certificates(branch_id, status);

ALTER TABLE public.certificate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificate_settings_branch_isolation ON public.certificate_settings
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY certificate_number_counters_branch_isolation ON public.certificate_number_counters
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY certificates_branch_isolation ON public.certificates
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.update_certificates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS certificates_updated_at ON public.certificates;
CREATE TRIGGER certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_certificates_updated_at();

DROP TRIGGER IF EXISTS certificate_settings_updated_at ON public.certificate_settings;
CREATE TRIGGER certificate_settings_updated_at
  BEFORE UPDATE ON public.certificate_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_certificates_updated_at();

CREATE OR REPLACE FUNCTION public.allocate_certificate_number(p_branch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_seq INT;
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;

  INSERT INTO public.certificate_number_counters (branch_id, year, last_seq)
  VALUES (p_branch_id, v_year, 1)
  ON CONFLICT (branch_id, year)
  DO UPDATE SET last_seq = public.certificate_number_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'CERT-' || v_year::TEXT || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

INSERT INTO public.features (code, name)
VALUES ('certificates', 'Certificates')
ON CONFLICT (code) DO UPDATE
SET name = excluded.name;

INSERT INTO public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
SELECT
  r.id,
  f.id,
  CASE
    WHEN r.name IN ('school_admin', 'principal') THEN 'edit'
    WHEN r.name IN ('academic_coordinator', 'admin_assistant', 'class_teacher', 'student', 'parent') THEN 'view'
    ELSE 'none'
  END,
  b.id,
  now(),
  'migration',
  'migration'
FROM public.roles r
CROSS JOIN public.features f
CROSS JOIN public.branches b
WHERE f.code = 'certificates'
  AND r.name IN (
    'school_admin', 'principal', 'academic_coordinator',
    'admin_assistant', 'class_teacher', 'student', 'parent'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.feature_id = f.id
      AND rp.branch_id = b.id
  );
