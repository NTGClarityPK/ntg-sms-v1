-- One-off data fix: remove appended student_id from profiles.full_name for ABC School Networks
-- (abcschool.edu) students where full_name was stored as "Lastname 0056" and student_id is "0056".
--
-- Tenant: ABC School Networks (code ABC-NET, domain abcschool.edu)
-- Run manually against Supabase SQL editor or psql when needed.
-- Safe to re-run only on rows still ending with ' ' || student_id.

-- Preview count:
-- SELECT count(*) FROM profiles p
-- JOIN students s ON s.user_id = p.id
-- JOIN branches b ON b.id = s.branch_id
-- WHERE b.tenant_id = '32bdcb32-d229-405e-9397-05cb02339355'
--   AND s.student_id IS NOT NULL AND length(trim(s.student_id)) > 0
--   AND length(p.full_name) >= length(s.student_id) + 2
--   AND right(p.full_name, length(s.student_id) + 1) = (' ' || s.student_id);

UPDATE profiles p
SET full_name = left(p.full_name, length(p.full_name) - length(s.student_id) - 1),
    updated_at = now()
FROM students s
JOIN branches b ON b.id = s.branch_id
WHERE p.id = s.user_id
  AND b.tenant_id = '32bdcb32-d229-405e-9397-05cb02339355'  -- ABC School Networks
  AND s.student_id IS NOT NULL
  AND length(trim(s.student_id)) > 0
  AND length(p.full_name) >= length(s.student_id) + 2
  AND right(p.full_name, length(s.student_id) + 1) = (' ' || s.student_id);
