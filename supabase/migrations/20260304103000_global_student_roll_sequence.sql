-- Make student_id globally unique (across all branches) and switch to a global numeric sequence.

-- 1. Fix duplicate numeric student_id values so each student_id is unique globally.
--    Old data may have the same roll number reused in different branches.
CREATE SEQUENCE IF NOT EXISTS public.student_roll_repair_seq;

SELECT setval(
  'public.student_roll_repair_seq',
  COALESCE(
    (SELECT MAX(student_id::integer) FROM public.students WHERE student_id ~ '^\d+$'),
    0
  )
);

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id
      ORDER BY created_at ASC NULLS LAST, id
    ) AS rn
  FROM public.students
  WHERE student_id ~ '^\d+$'
)
UPDATE public.students s
SET student_id = LPAD(nextval('public.student_roll_repair_seq')::text, 4, '0')
FROM numbered n
WHERE s.id = n.id
  AND n.rn > 1;

DROP SEQUENCE IF EXISTS public.student_roll_repair_seq;

-- 2. Enforce global uniqueness on student_id (no branch scope).
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_student_id_branch_id_key;

ALTER TABLE public.students
  ADD CONSTRAINT students_student_id_key UNIQUE (student_id);

-- 3. Create a global roll-number sequence for future inserts.
CREATE SEQUENCE IF NOT EXISTS public.student_roll_seq;

SELECT setval(
  'public.student_roll_seq',
  COALESCE(
    (SELECT MAX(student_id::integer) FROM public.students WHERE student_id ~ '^\d+$'),
    0
  )
);

CREATE OR REPLACE FUNCTION public.next_student_roll()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  next_val := nextval('public.student_roll_seq');
  RETURN LPAD(next_val::text, 4, '0');
END;
$$;

-- 4. Update trigger function to use the global sequence instead of branch-specific table.
CREATE OR REPLACE FUNCTION public.set_student_roll_number_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS NULL OR TRIM(COALESCE(NEW.student_id, '')) = '' THEN
    NEW.student_id := public.next_student_roll();
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Clean up old branch-scoped sequence artifacts (no longer used).
DROP FUNCTION IF EXISTS public.next_roll_number_for_branch(uuid);
DROP TABLE IF EXISTS public.branch_roll_sequences;

