export type EarlyDepartureStatus = 'pending' | 'approved' | 'rejected';

export interface EarlyDepartureRequest {
  id: string;
  studentId: string;
  requestedBy: string;
  date: string;
  departureTime: string;
  reason?: string;
  attachmentUrl?: string;
  status: EarlyDepartureStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}


