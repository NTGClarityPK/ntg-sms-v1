-- Must run after migration that adds enum value 'absent'
UPDATE leave_requests
SET
  status = 'absent',
  reviewed_at = NULL
WHERE reason = 'Unrequested absence - automatically created from attendance record'
  AND status = 'approved';
