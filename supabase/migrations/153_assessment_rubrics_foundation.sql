-- Assessment rubrics foundation (standalone; Google Classroom builds on this later)

-- ---------------------------------------------------------------------------
-- Rubric presets (global + branch-specific)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rubric_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  preset_name TEXT NOT NULL,
  preset_code TEXT,
  description TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rubric_presets_code UNIQUE (preset_code)
);

CREATE INDEX IF NOT EXISTS idx_rubric_presets_branch
  ON public.rubric_presets(branch_id)
  WHERE branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.rubric_preset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES public.rubric_presets(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  category_code TEXT,
  default_marks NUMERIC(6,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubric_preset_categories_preset
  ON public.rubric_preset_categories(preset_id);

-- ---------------------------------------------------------------------------
-- Assessment rubrics + categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  rubric_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (rubric_type IN ('ktac', 'custom', 'preset_named')),
  preset_id UUID REFERENCES public.rubric_presets(id) ON DELETE SET NULL,
  total_marks NUMERIC(6,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'alma'
    CHECK (source IN ('alma', 'google_classroom')),
  google_rubric_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assessment_rubrics_assessment UNIQUE (assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_rubrics_branch
  ON public.assessment_rubrics(branch_id);

CREATE TABLE IF NOT EXISTS public.rubric_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES public.assessment_rubrics(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  category_code TEXT,
  max_marks NUMERIC(6,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  google_criterion_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubric_categories_rubric
  ON public.rubric_categories(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_categories_google
  ON public.rubric_categories(google_criterion_id)
  WHERE google_criterion_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Per-category student scores (linked to student_grades)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_rubric_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_grade_id UUID NOT NULL REFERENCES public.student_grades(id) ON DELETE CASCADE,
  rubric_category_id UUID NOT NULL REFERENCES public.rubric_categories(id) ON DELETE RESTRICT,
  marks_obtained NUMERIC(6,2),
  feedback TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  graded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'google_classroom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_rubric_scores_grade_category
    UNIQUE (student_grade_id, rubric_category_id)
);

CREATE INDEX IF NOT EXISTS idx_student_rubric_scores_branch
  ON public.student_rubric_scores(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_rubric_scores_category
  ON public.student_rubric_scores(rubric_category_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.rubric_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_preset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_rubric_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rubric_presets_access ON public.rubric_presets;
CREATE POLICY rubric_presets_access ON public.rubric_presets
  FOR ALL USING (
    is_global = true
    OR branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rubric_preset_categories_access ON public.rubric_preset_categories;
CREATE POLICY rubric_preset_categories_access ON public.rubric_preset_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rubric_presets p
      WHERE p.id = rubric_preset_categories.preset_id
        AND (
          p.is_global = true
          OR p.branch_id IN (
            SELECT branch_id FROM public.user_branches
            WHERE user_id = (SELECT auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS assessment_rubrics_branch_isolation ON public.assessment_rubrics;
CREATE POLICY assessment_rubrics_branch_isolation ON public.assessment_rubrics
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS rubric_categories_branch_isolation ON public.rubric_categories;
CREATE POLICY rubric_categories_branch_isolation ON public.rubric_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assessment_rubrics ar
      WHERE ar.id = rubric_categories.rubric_id
        AND ar.branch_id IN (
          SELECT branch_id FROM public.user_branches
          WHERE user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS student_rubric_scores_branch_isolation ON public.student_rubric_scores;
CREATE POLICY student_rubric_scores_branch_isolation ON public.student_rubric_scores
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_rubrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rubric_presets_updated_at ON public.rubric_presets;
CREATE TRIGGER rubric_presets_updated_at
  BEFORE UPDATE ON public.rubric_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_rubrics_updated_at();

DROP TRIGGER IF EXISTS assessment_rubrics_updated_at ON public.assessment_rubrics;
CREATE TRIGGER assessment_rubrics_updated_at
  BEFORE UPDATE ON public.assessment_rubrics
  FOR EACH ROW EXECUTE FUNCTION public.update_rubrics_updated_at();

DROP TRIGGER IF EXISTS rubric_categories_updated_at ON public.rubric_categories;
CREATE TRIGGER rubric_categories_updated_at
  BEFORE UPDATE ON public.rubric_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_rubrics_updated_at();

DROP TRIGGER IF EXISTS student_rubric_scores_updated_at ON public.student_rubric_scores;
CREATE TRIGGER student_rubric_scores_updated_at
  BEFORE UPDATE ON public.student_rubric_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_rubrics_updated_at();

-- ---------------------------------------------------------------------------
-- Seed Ontario KTAC global preset
-- ---------------------------------------------------------------------------
INSERT INTO public.rubric_presets (preset_name, preset_code, description, is_global, is_active)
VALUES (
  'Ontario KTAC',
  'ontario_ktac',
  'Ontario Ministry of Education 4-category assessment framework',
  true,
  true
)
ON CONFLICT (preset_code) DO UPDATE
SET
  preset_name = EXCLUDED.preset_name,
  description = EXCLUDED.description,
  is_global = true,
  is_active = true,
  updated_at = now();

INSERT INTO public.rubric_preset_categories (
  preset_id, category_name, category_code, default_marks, sort_order, description
)
SELECT p.id, v.category_name, v.category_code, v.default_marks, v.sort_order, v.description
FROM public.rubric_presets p
CROSS JOIN (
  VALUES
    ('Knowledge and Understanding', 'K', 10.00, 0, 'Knowledge and Understanding'),
    ('Thinking', 'T', 8.00, 1, 'Thinking and Inquiry'),
    ('Application', 'A', 12.00, 2, 'Application'),
    ('Communication', 'C', 5.00, 3, 'Communication')
) AS v(category_name, category_code, default_marks, sort_order, description)
WHERE p.preset_code = 'ontario_ktac'
  AND NOT EXISTS (
    SELECT 1 FROM public.rubric_preset_categories c
    WHERE c.preset_id = p.id AND c.category_code = v.category_code
  );

-- ---------------------------------------------------------------------------
-- Feature + role permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.features (code, name)
VALUES ('assessment_rubrics', 'Assessment Rubrics')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
SELECT
  r.id,
  f.id,
  CASE
    WHEN r.name IN ('school_admin', 'principal') THEN 'edit'
    WHEN r.name IN ('academic_coordinator', 'class_teacher', 'subject_teacher') THEN 'edit'
    WHEN r.name IN ('admin_assistant', 'student', 'parent') THEN 'view'
    ELSE 'none'
  END,
  b.id,
  now(),
  'migration',
  'migration'
FROM public.roles r
CROSS JOIN public.features f
CROSS JOIN public.branches b
WHERE f.code = 'assessment_rubrics'
  AND r.name IN (
    'school_admin', 'principal', 'academic_coordinator',
    'admin_assistant', 'class_teacher', 'subject_teacher', 'student', 'parent'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.feature_id = f.id
      AND rp.branch_id = b.id
  );
