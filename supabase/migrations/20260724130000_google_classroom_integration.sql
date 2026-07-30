-- Google Classroom integration: settings, mappings, assessment columns, audit log

-- ---------------------------------------------------------------------------
-- Alter assessments for Google linking
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS grading_source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS google_coursework_id TEXT,
  ADD COLUMN IF NOT EXISTS google_course_id TEXT,
  ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_rubric BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assessments_grading_source_check'
  ) THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_grading_source_check
      CHECK (grading_source IN ('manual', 'google_classroom'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessments_google_coursework
  ON public.assessments(google_coursework_id)
  WHERE google_coursework_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_grading_source
  ON public.assessments(grading_source, branch_id);

-- ---------------------------------------------------------------------------
-- google_workspace_settings (one per branch)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  is_feature_enabled BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  google_domain TEXT,
  connected_email TEXT,
  connected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_workspace_settings_branch UNIQUE (branch_id)
);

ALTER TABLE public.google_workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_workspace_settings_branch_isolation ON public.google_workspace_settings;
CREATE POLICY google_workspace_settings_branch_isolation ON public.google_workspace_settings
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP TRIGGER IF EXISTS google_workspace_settings_updated_at ON public.google_workspace_settings;
CREATE TRIGGER google_workspace_settings_updated_at
  BEFORE UPDATE ON public.google_workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_rubrics_updated_at();

-- ---------------------------------------------------------------------------
-- Course mappings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_classroom_course_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  class_section_id UUID NOT NULL REFERENCES public.class_sections(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  google_course_id TEXT NOT NULL,
  google_course_name TEXT,
  google_course_section TEXT,
  linked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gc_mapping_unique
  ON public.google_classroom_course_mappings(class_section_id, subject_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gc_mapping_branch
  ON public.google_classroom_course_mappings(branch_id);

ALTER TABLE public.google_classroom_course_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_course_mappings_branch_isolation ON public.google_classroom_course_mappings;
CREATE POLICY gc_course_mappings_branch_isolation ON public.google_classroom_course_mappings
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP TRIGGER IF EXISTS gc_course_mappings_updated_at ON public.google_classroom_course_mappings;
CREATE TRIGGER gc_course_mappings_updated_at
  BEFORE UPDATE ON public.google_classroom_course_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_rubrics_updated_at();

-- ---------------------------------------------------------------------------
-- Sync audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sync_status TEXT NOT NULL DEFAULT 'started'
    CHECK (sync_status IN ('started', 'success', 'partial', 'failed')),
  students_synced INTEGER NOT NULL DEFAULT 0,
  students_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_assessment
  ON public.google_sync_audit_log(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sync_audit_branch_date
  ON public.google_sync_audit_log(branch_id, created_at DESC);

ALTER TABLE public.google_sync_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_sync_audit_branch_isolation ON public.google_sync_audit_log;
CREATE POLICY google_sync_audit_branch_isolation ON public.google_sync_audit_log
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Feature + permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.features (code, name)
VALUES ('google_classroom_integration', 'Google Classroom Integration')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
SELECT
  r.id,
  f.id,
  CASE
    WHEN r.name IN ('school_admin', 'principal') THEN 'edit'
    WHEN r.name IN ('class_teacher', 'subject_teacher', 'academic_coordinator') THEN 'edit'
    WHEN r.name IN ('admin_assistant') THEN 'view'
    ELSE 'none'
  END,
  b.id,
  now(),
  'migration',
  'migration'
FROM public.roles r
CROSS JOIN public.features f
CROSS JOIN public.branches b
WHERE f.code = 'google_classroom_integration'
  AND r.name IN (
    'school_admin', 'principal', 'academic_coordinator',
    'admin_assistant', 'class_teacher', 'subject_teacher'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.feature_id = f.id
      AND rp.branch_id = b.id
  );
