export type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'absent';

export interface LeaveRequest {
  id: string;
  studentId: string;
  requestedBy: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  reviewerName?: string;
  reviewerRole?: string;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
  /** Student's leave quota usage (used days / total quota) for list display. */
  quotaUsage?: { usedDays: number; totalQuota: number };
}

export interface LeaveQuota {
  totalQuota: number;
  usedDays: number;
  remainingDays: number;
  /** Days counted from absences (marked absent in attendance). */
  daysFromAbsences?: number;
}


