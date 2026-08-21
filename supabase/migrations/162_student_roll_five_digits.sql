-- Migrate student roll numbers from 4-digit to 5-digit zero-padded format.
-- Approach B: pad all existing rolls + generate new rolls as 5 digits.

-- 1) Pad existing numeric rolls to 5 digits (0971 -> 00971)
UPDATE public.students
SET student_id = LPAD(student_id, 5, '0'),
    updated_at = NOW()
WHERE student_id ~ '^[0-9]+$'
  AND length(student_id) < 5;

-- 2) New rolls use 5-digit padding
CREATE OR REPLACE FUNCTION public.next_student_roll()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  next_val := nextval('public.student_roll_seq');
  RETURN LPAD(next_val::text, 5, '0');
END;
$$;

COMMENT ON FUNCTION public.next_student_roll() IS
  'Returns next globally unique student roll number as 5-digit zero-padded text.';
