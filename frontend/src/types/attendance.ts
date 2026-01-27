export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Attendance {
  id: string;
  studentId: string;
  studentIdNumber?: string; // The student's unique identifier (e.g., "2026-Class 1-A-001")
  studentName: string;
  classSectionId: string;
  className: string;
  sectionName: string;
  date: string;
  status: AttendanceStatus;
  entryTime?: string;
  exitTime?: string;
  notes?: string;
  markedById?: string;
  markedByName?: string;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttendanceInput {
  studentId: string;
  status: AttendanceStatus;
  entryTime?: string;
  exitTime?: string;
  notes?: string;
}

export interface BulkMarkAttendanceInput {
  classSectionId: string;
  date: string;
  records: CreateAttendanceInput[];
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  entryTime?: string;
  exitTime?: string;
  notes?: string;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  percentage: number;
}

export interface AttendanceReport {
  startDate: string;
  endDate: string;
  classSectionId?: string;
  className?: string;
  sectionName?: string;
  summary: AttendanceSummary;
  records: Attendance[];
}

