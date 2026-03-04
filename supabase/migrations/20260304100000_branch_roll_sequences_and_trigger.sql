-- Roll number: per-branch sequential 4-digit (0001, 0002, ...). No letters, no year/STU prefix.
-- Sequence is scoped per branch; (branch_id, student_id) remains unique.

-- 1. Table to track last assigned sequence per branch
CREATE TABLE IF NOT EXISTS public.branch_roll_sequences (
  branch_id UUID NOT NULL PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

-- 2. Function: atomically increment and return next roll number for a branch (4-digit padded)
CREATE OR REPLACE FUNCTION public.next_roll_number_for_branch(p_branch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO public.branch_roll_sequences (branch_id, last_sequence)
  VALUES (p_branch_id, 1)
  ON CONFLICT (branch_id) DO UPDATE
  SET last_sequence = public.branch_roll_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_val;
  RETURN LPAD(next_val::text, 4, '0');
END;
$$;

-- 3. Data migration: assign existing students new sequential roll numbers per branch (by created_at, id)
WITH numbered AS (
  SELECT id, branch_id, ROW_NUMBER() OVER (PARTITION BY branch_id ORDER BY created_at ASC NULLS LAST, id) AS rn
  FROM public.students
)
UPDATE public.students s
SET student_id = LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

-- 4. Seed branch_roll_sequences so next new student gets max+1 per branch (use same numbering as step 3)
INSERT INTO public.branch_roll_sequences (branch_id, last_sequence)
SELECT branch_id, MAX(rn)
FROM (
  SELECT branch_id, ROW_NUMBER() OVER (PARTITION BY branch_id ORDER BY created_at ASC NULLS LAST, id) AS rn
  FROM public.students
) sub
WHERE branch_id IS NOT NULL
GROUP BY branch_id
ON CONFLICT (branch_id) DO UPDATE
SET last_sequence = GREATEST(public.branch_roll_sequences.last_sequence, EXCLUDED.last_sequence);

-- 5. Trigger: assign roll number on INSERT when student_id is null or empty
CREATE OR REPLACE FUNCTION public.set_student_roll_number_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS NULL OR TRIM(COALESCE(NEW.student_id, '')) = '' THEN
    IF NEW.branch_id IS NOT NULL THEN
      NEW.student_id := public.next_roll_number_for_branch(NEW.branch_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_set_roll_number ON public.students;
CREATE TRIGGER trg_students_set_roll_number
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_student_roll_number_on_insert();
