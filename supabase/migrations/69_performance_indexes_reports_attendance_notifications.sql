-- Performance indexes for reports, attendance list/summary, and notifications (performancemetricsv3 H3).
-- Safe to run: IF NOT EXISTS prevents errors if an index was added elsewhere.

-- Attendance: list/summary/report filters by branch, year, date, class_section
CREATE INDEX IF NOT EXISTS idx_attendance_branch_year_date_class_section
  ON attendance (branch_id, academic_year_id, date, class_section_id);

-- Attendance: per-student and status aggregation (summary by student, low-attendance)
CREATE INDEX IF NOT EXISTS idx_attendance_student_branch_year_date_status
  ON attendance (student_id, branch_id, academic_year_id, date, status);

-- Notifications: list and unread count by user and read state
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications (user_id, is_read, created_at);
