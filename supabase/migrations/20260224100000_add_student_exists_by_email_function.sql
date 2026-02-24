-- Allow bulk import to check if a student already exists for an email in a branch.
-- Uses auth.users so only callable from backend/service role.
CREATE OR REPLACE FUNCTION public.student_exists_by_email(p_email text, p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN auth.users u ON u.id = s.user_id
    WHERE lower(trim(u.email)) = lower(trim(p_email))
      AND s.branch_id = p_branch_id
  );
$$;

COMMENT ON FUNCTION public.student_exists_by_email(text, uuid) IS
  'Returns true if a student record exists for the given email in the given branch. Used by bulk import to avoid duplicates.';
