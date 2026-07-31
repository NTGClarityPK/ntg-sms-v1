-- Remove generic audit trail and super_admin role.
-- Prerequisites: application no longer writes/reads audit_logs or depends on super_admin.
-- Existing audit rows must be archived externally before this migration runs.

-- 1) Defensively convert any remaining super_admin assignments to school_admin on the same branch
WITH sa AS (
  SELECT id AS super_admin_role_id
  FROM public.roles
  WHERE name::text = 'super_admin'
  LIMIT 1
),
school AS (
  SELECT id AS school_admin_role_id
  FROM public.roles
  WHERE name::text = 'school_admin'
  LIMIT 1
),
converted AS (
  INSERT INTO public.user_roles (user_id, role_id, branch_id)
  SELECT ur.user_id, school.school_admin_role_id, ur.branch_id
  FROM public.user_roles ur
  CROSS JOIN sa
  CROSS JOIN school
  WHERE ur.role_id = sa.super_admin_role_id
  ON CONFLICT DO NOTHING
  RETURNING user_id
)
DELETE FROM public.user_roles ur
USING sa
WHERE ur.role_id = sa.super_admin_role_id;

DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE r.name::text = 'super_admin';

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Cannot drop super_admin: % user_roles assignments remain', remaining;
  END IF;
END $$;

-- 2) Drop audit_logs (indexes + RLS policies cascade with the table)
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- 3) Delete super_admin role row (cascades role_permissions)
DELETE FROM public.roles WHERE name::text = 'super_admin';

-- 4) Rebuild user_role enum without super_admin.
-- Policies that cast r.name to user_role must be dropped first, then recreated.
DROP POLICY IF EXISTS "Teachers mark own class attendance" ON public.attendance;
DROP POLICY IF EXISTS "early_departure_access" ON public.early_departure_requests;
DROP POLICY IF EXISTS "leave_requests_access" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can manage parent-student links in their branches" ON public.parent_students;
DROP POLICY IF EXISTS "Admins can view parent-student links in their branches" ON public.parent_students;
DROP POLICY IF EXISTS "Admins can manage staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "subscription_update_policy" ON public.subscriptions;
DROP POLICY IF EXISTS "Staff manage branch timetables" ON public.timetable_slots;
DROP POLICY IF EXISTS "Teachers view assigned class timetables" ON public.timetable_slots;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'super_admin'
  ) THEN
    CREATE TYPE public.user_role_new AS ENUM (
      'parent',
      'student',
      'principal',
      'school_admin',
      'academic_coordinator',
      'class_teacher',
      'subject_teacher',
      'guidance_counselor',
      'admin_assistant'
    );

    ALTER TABLE public.roles
      ALTER COLUMN name TYPE public.user_role_new
      USING name::text::public.user_role_new;

    DROP TYPE public.user_role;
    ALTER TYPE public.user_role_new RENAME TO user_role;
  END IF;
END $$;

-- 5) Recreate policies that depended on roles.name / user_role
CREATE POLICY "Teachers mark own class attendance"
  ON public.attendance
  FOR ALL
  USING (
    (class_section_id IN (
      SELECT cs.id
      FROM class_sections cs
      WHERE cs.class_teacher_id IN (
        SELECT staff.id FROM staff WHERE staff.user_id = auth.uid()
      )
    ))
    OR (EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.branch_id = attendance.branch_id
        AND r.name = ANY (ARRAY['school_admin'::user_role, 'principal'::user_role])
    ))
    OR (EXISTS (
      SELECT 1
      FROM parent_students ps
      WHERE ps.parent_user_id = auth.uid()
        AND ps.student_id = attendance.student_id
    ))
  );

CREATE POLICY "early_departure_access"
  ON public.early_departure_requests
  FOR ALL
  USING (
    (requested_by = auth.uid())
    OR (EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.branch_id = early_departure_requests.branch_id
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'class_teacher'::user_role,
          'admin_assistant'::user_role
        ])
    ))
  );

CREATE POLICY "leave_requests_access"
  ON public.leave_requests
  FOR ALL
  USING (
    (requested_by = auth.uid())
    OR (EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.branch_id = leave_requests.branch_id
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'class_teacher'::user_role,
          'admin_assistant'::user_role
        ])
    ))
  );

CREATE POLICY "Admins can manage parent-student links in their branches"
  ON public.parent_students
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM students s
      JOIN user_branches ub ON ub.branch_id = s.branch_id
      JOIN user_roles ur ON ur.user_id = ub.user_id AND ur.branch_id = ub.branch_id
      JOIN roles r ON r.id = ur.role_id
      WHERE s.id = parent_students.student_id
        AND ub.user_id = auth.uid()
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'academic_coordinator'::user_role
        ])
    )
  );

CREATE POLICY "Admins can view parent-student links in their branches"
  ON public.parent_students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM students s
      JOIN user_branches ub ON ub.branch_id = s.branch_id
      JOIN user_roles ur ON ur.user_id = ub.user_id AND ur.branch_id = ub.branch_id
      JOIN roles r ON r.id = ur.role_id
      WHERE s.id = parent_students.student_id
        AND ub.user_id = auth.uid()
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'academic_coordinator'::user_role
        ])
    )
  );

CREATE POLICY "Admins can manage staff"
  ON public.staff
  FOR ALL
  USING (
    branch_id IN (
      SELECT ub.branch_id
      FROM user_branches ub
      JOIN user_roles ur ON ur.user_id = ub.user_id AND ur.branch_id = ub.branch_id
      JOIN roles r ON r.id = ur.role_id
      WHERE ub.user_id = auth.uid()
        AND r.name = ANY (ARRAY['school_admin'::user_role, 'principal'::user_role])
    )
  );

CREATE POLICY "Admins can manage students"
  ON public.students
  FOR ALL
  USING (
    branch_id IN (
      SELECT ub.branch_id
      FROM user_branches ub
      JOIN user_roles ur ON ur.user_id = ub.user_id AND ur.branch_id = ub.branch_id
      JOIN roles r ON r.id = ur.role_id
      WHERE ub.user_id = auth.uid()
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'academic_coordinator'::user_role
        ])
    )
  );

CREATE POLICY "subscription_update_policy"
  ON public.subscriptions
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT b.tenant_id
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN branches b ON b.id = ur.branch_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name = 'school_admin'::user_role
    )
  );

CREATE POLICY "Staff manage branch timetables"
  ON public.timetable_slots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.branch_id = timetable_slots.branch_id
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'academic_coordinator'::user_role,
          'class_teacher'::user_role
        ])
    )
  );

CREATE POLICY "Teachers view assigned class timetables"
  ON public.timetable_slots
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1
      FROM teacher_assignments ta
      WHERE ta.class_section_id = timetable_slots.class_section_id
        AND ta.staff_id IN (SELECT staff.id FROM staff WHERE staff.user_id = auth.uid())
        AND ta.branch_id = timetable_slots.branch_id
    ))
    OR (EXISTS (
      SELECT 1
      FROM class_sections cs
      WHERE cs.id = timetable_slots.class_section_id
        AND cs.class_teacher_id IN (SELECT staff.id FROM staff WHERE staff.user_id = auth.uid())
        AND cs.branch_id = timetable_slots.branch_id
    ))
    OR (EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND ur.branch_id = timetable_slots.branch_id
        AND r.name = ANY (ARRAY[
          'school_admin'::user_role,
          'principal'::user_role,
          'academic_coordinator'::user_role,
          'class_teacher'::user_role
        ])
    ))
  );

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles
  FOR ALL
  USING (
    branch_id IN (
      SELECT ub.branch_id
      FROM user_branches ub
      JOIN user_roles ur ON ur.user_id = ub.user_id AND ur.branch_id = ub.branch_id
      JOIN roles r ON r.id = ur.role_id
      WHERE ub.user_id = auth.uid()
        AND r.name = ANY (ARRAY['school_admin'::user_role, 'principal'::user_role])
    )
  );
