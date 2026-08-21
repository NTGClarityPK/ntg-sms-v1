-- Terminal status for attendance-sourced absence rows (distinct from approved planned leave)
ALTER TYPE leave_status ADD VALUE IF NOT EXISTS 'absent';
