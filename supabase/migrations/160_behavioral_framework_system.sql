-- Behavioural framework rating system (alongside existing star-based tables)

-- ---------------------------------------------------------------------------
-- Presets (global + branch-owned)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.behavioral_framework_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
  preset_code TEXT,
  preset_name TEXT NOT NULL,
  description TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  default_rating_scale JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_behavioral_framework_presets_code UNIQUE (preset_code),
  CONSTRAINT chk_behavioral_framework_presets_global_branch CHECK (
    (is_global = true AND branch_id IS NULL)
    OR (is_global = false AND branch_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_behavioral_framework_presets_branch
  ON public.behavioral_framework_presets(branch_id)
  WHERE branch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Categories under a preset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.behavioral_framework_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES public.behavioral_framework_presets(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavioral_framework_categories_preset
  ON public.behavioral_framework_categories(preset_id);

-- ---------------------------------------------------------------------------
-- Per-branch active system config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_behavioral_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  active_system TEXT NOT NULL DEFAULT 'star_based'
    CHECK (active_system IN ('star_based', 'framework_based')),
  framework_preset_id UUID REFERENCES public.behavioral_framework_presets(id) ON DELETE SET NULL,
  switched_at TIMESTAMPTZ,
  switched_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_branch_behavioral_config_branch UNIQUE (branch_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_behavioral_config_preset
  ON public.branch_behavioral_config(framework_preset_id)
  WHERE framework_preset_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Student framework ratings (monthly header)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_framework_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  preset_id UUID NOT NULL REFERENCES public.behavioral_framework_presets(id) ON DELETE RESTRICT,
  rating_period TEXT NOT NULL DEFAULT 'monthly',
  period_label TEXT NOT NULL,
  assessment_month DATE NOT NULL,
  rated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_framework_ratings_student_rater_month
    UNIQUE (student_id, rated_by, assessment_month)
);

CREATE INDEX IF NOT EXISTS idx_student_framework_ratings_branch
  ON public.student_framework_ratings(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_framework_ratings_student_month
  ON public.student_framework_ratings(student_id, assessment_month);
CREATE INDEX IF NOT EXISTS idx_student_framework_ratings_preset
  ON public.student_framework_ratings(preset_id);
CREATE INDEX IF NOT EXISTS idx_student_framework_ratings_year
  ON public.student_framework_ratings(academic_year_id);

-- ---------------------------------------------------------------------------
-- Per-category scores (with name snapshot)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_framework_category_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID NOT NULL REFERENCES public.student_framework_ratings(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.behavioral_framework_categories(id) ON DELETE RESTRICT,
  category_name TEXT NOT NULL,
  rating_code TEXT NOT NULL,
  teacher_comment TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_framework_category_scores_rating_category
    UNIQUE (rating_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_student_framework_category_scores_branch
  ON public.student_framework_category_scores(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_framework_category_scores_rating
  ON public.student_framework_category_scores(rating_id);
CREATE INDEX IF NOT EXISTS idx_student_framework_category_scores_category
  ON public.student_framework_category_scores(category_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.behavioral_framework_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_framework_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_behavioral_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_framework_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_framework_category_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS behavioral_framework_presets_access ON public.behavioral_framework_presets;
CREATE POLICY behavioral_framework_presets_access ON public.behavioral_framework_presets
  FOR ALL USING (
    is_global = true
    OR branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS behavioral_framework_categories_access ON public.behavioral_framework_categories;
CREATE POLICY behavioral_framework_categories_access ON public.behavioral_framework_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.behavioral_framework_presets p
      WHERE p.id = behavioral_framework_categories.preset_id
        AND (
          p.is_global = true
          OR p.branch_id IN (
            SELECT branch_id FROM public.user_branches
            WHERE user_id = (SELECT auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS branch_behavioral_config_branch_isolation ON public.branch_behavioral_config;
CREATE POLICY branch_behavioral_config_branch_isolation ON public.branch_behavioral_config
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS student_framework_ratings_branch_isolation ON public.student_framework_ratings;
CREATE POLICY student_framework_ratings_branch_isolation ON public.student_framework_ratings
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS student_framework_category_scores_branch_isolation ON public.student_framework_category_scores;
CREATE POLICY student_framework_category_scores_branch_isolation ON public.student_framework_category_scores
  FOR ALL USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_behavioral_framework_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS behavioral_framework_presets_updated_at ON public.behavioral_framework_presets;
CREATE TRIGGER behavioral_framework_presets_updated_at
  BEFORE UPDATE ON public.behavioral_framework_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_behavioral_framework_updated_at();

DROP TRIGGER IF EXISTS behavioral_framework_categories_updated_at ON public.behavioral_framework_categories;
CREATE TRIGGER behavioral_framework_categories_updated_at
  BEFORE UPDATE ON public.behavioral_framework_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_behavioral_framework_updated_at();

DROP TRIGGER IF EXISTS branch_behavioral_config_updated_at ON public.branch_behavioral_config;
CREATE TRIGGER branch_behavioral_config_updated_at
  BEFORE UPDATE ON public.branch_behavioral_config
  FOR EACH ROW EXECUTE FUNCTION public.update_behavioral_framework_updated_at();

DROP TRIGGER IF EXISTS student_framework_ratings_updated_at ON public.student_framework_ratings;
CREATE TRIGGER student_framework_ratings_updated_at
  BEFORE UPDATE ON public.student_framework_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_behavioral_framework_updated_at();

DROP TRIGGER IF EXISTS student_framework_category_scores_updated_at ON public.student_framework_category_scores;
CREATE TRIGGER student_framework_category_scores_updated_at
  BEFORE UPDATE ON public.student_framework_category_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_behavioral_framework_updated_at();

-- ---------------------------------------------------------------------------
-- Seed Ontario Learning Skills global preset
-- ---------------------------------------------------------------------------
INSERT INTO public.behavioral_framework_presets (
  preset_code,
  preset_name,
  description,
  is_global,
  branch_id,
  default_rating_scale,
  comments_required
)
VALUES (
  'ontario_learning_skills',
  'Ontario Learning Skills and Work Habits',
  'Ontario Ministry of Education framework (Growing Success, 2010)',
  true,
  NULL,
  '[
    {"code":"E","label":"Excellent","order":1},
    {"code":"G","label":"Good","order":2},
    {"code":"S","label":"Satisfactory","order":3},
    {"code":"N","label":"Needs Improvement","order":4}
  ]'::jsonb,
  true
)
ON CONFLICT (preset_code) DO UPDATE
SET
  preset_name = EXCLUDED.preset_name,
  description = EXCLUDED.description,
  is_global = true,
  branch_id = NULL,
  default_rating_scale = EXCLUDED.default_rating_scale,
  comments_required = EXCLUDED.comments_required,
  updated_at = now();

INSERT INTO public.behavioral_framework_categories (
  preset_id, category_name, description, sort_order, indicators
)
SELECT p.id, v.category_name, v.description, v.sort_order, v.indicators::jsonb
FROM public.behavioral_framework_presets p
CROSS JOIN (
  VALUES
    (
      'Responsibility',
      'Fulfils responsibilities and commitments within the learning environment',
      0,
      '["Fulfils responsibilities and commitments within the learning environment","Completes and submits classwork, homework, and assignments according to agreed timelines","Takes responsibility for and manages own behaviour"]'
    ),
    (
      'Organization',
      'Devises and follows a plan and process for completing work and tasks',
      1,
      '["Devises and follows a plan and process for completing work and tasks","Establishes priorities and manages time to complete tasks","Identifies, gathers, evaluates, and uses information, technology, and resources"]'
    ),
    (
      'Independent Work',
      'Independently monitors, assesses, and revises plans to complete tasks',
      2,
      '["Independently monitors, assesses, and revises plans to complete tasks","Uses class time appropriately to complete tasks","Follows instructions with minimal supervision"]'
    ),
    (
      'Collaboration',
      'Accepts various roles and an equitable share of work in a group',
      3,
      '["Accepts various roles and an equitable share of work in a group","Responds positively to the ideas, opinions, values, and traditions of others","Builds healthy peer-to-peer relationships"]'
    ),
    (
      'Initiative',
      'Looks for and acts on new ideas and opportunities for learning',
      4,
      '["Looks for and acts on new ideas and opportunities for learning","Demonstrates the capacity for innovation and a willingness to take risks","Approaches new tasks with a positive attitude"]'
    ),
    (
      'Self-Regulation',
      'Sets own individual goals and monitors progress towards achieving them',
      5,
      '["Sets own individual goals and monitors progress towards achieving them","Seeks clarification or assistance when needed","Assesses and reflects critically on own strengths, needs, and interests"]'
    )
) AS v(category_name, description, sort_order, indicators)
WHERE p.preset_code = 'ontario_learning_skills'
  AND NOT EXISTS (
    SELECT 1 FROM public.behavioral_framework_categories c
    WHERE c.preset_id = p.id AND c.category_name = v.category_name
  );
