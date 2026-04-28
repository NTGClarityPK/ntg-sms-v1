-- Performance indexes for auth bootstrap and settings status checks.
-- Safe to run: IF NOT EXISTS prevents errors if indexes already exist.

-- Auth bootstrap: /api/v1/auth/me and BranchGuard
CREATE INDEX IF NOT EXISTS idx_profiles_current_branch_id
  ON profiles (current_branch_id);

CREATE INDEX IF NOT EXISTS idx_profiles_current_student_id
  ON profiles (current_student_id);

CREATE INDEX IF NOT EXISTS idx_user_branches_user_id_branch_id
  ON user_branches (user_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON user_roles (role_id);

CREATE INDEX IF NOT EXISTS idx_students_user_id_branch_id
  ON students (user_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_students_branch_id
  ON students (branch_id);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent_user_id
  ON parent_students (parent_user_id);

-- Settings status: /api/v1/settings-status/status
CREATE INDEX IF NOT EXISTS idx_academic_years_tenant_is_active
  ON academic_years (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_system_settings_key
  ON system_settings (key);

CREATE INDEX IF NOT EXISTS idx_role_permissions_branch_id
  ON role_permissions (branch_id);

CREATE INDEX IF NOT EXISTS idx_assessment_types_branch_id
  ON assessment_types (branch_id);

CREATE INDEX IF NOT EXISTS idx_grade_templates_branch_id
  ON grade_templates (branch_id);

CREATE INDEX IF NOT EXISTS idx_classes_branch_id
  ON classes (branch_id);

CREATE INDEX IF NOT EXISTS idx_sections_branch_id
  ON sections (branch_id);

CREATE INDEX IF NOT EXISTS idx_levels_branch_id
  ON levels (branch_id);

CREATE INDEX IF NOT EXISTS idx_timing_templates_branch_id
  ON timing_templates (branch_id);

CREATE INDEX IF NOT EXISTS idx_subjects_branch_id
  ON subjects (branch_id);

