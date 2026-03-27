-- Fix student_roll_seq initialisation by using Postgres-compatible digit regex.
-- Postgres regex does NOT support \d, so use [0-9].
--
-- This migration is safe to run multiple times (idempotent enough for setval()).

-- Reset global roll-number sequence to current maximum numeric student_id.
SELECT setval(
  'public.student_roll_seq',
  COALESCE(
    (SELECT MAX(student_id::int) FROM public.students WHERE student_id ~ '^[0-9]+$'),
    0
  )
);

