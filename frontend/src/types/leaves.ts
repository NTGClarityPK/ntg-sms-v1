export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

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
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveQuota {
  totalQuota: number;
  usedDays: number;
  remainingDays: number;
}


