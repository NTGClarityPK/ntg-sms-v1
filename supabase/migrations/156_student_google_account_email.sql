-- Optional Google Classroom identity for grade sync matching
-- (distinct from school login / invitation emails).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS google_account_email TEXT;

COMMENT ON COLUMN public.students.google_account_email IS
  'Optional Google account email used to match Google Classroom roster for grade sync. Distinct from login and invitation emails.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_branch_google_account_email
  ON public.students (branch_id, lower(google_account_email))
  WHERE google_account_email IS NOT NULL AND btrim(google_account_email) <> '';
