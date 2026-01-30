import { LeaveStatus } from './leave-status.type';

export class LeaveRequestDto {
  id!: string;
  studentId!: string;
  requestedBy!: string;
  startDate!: string;
  endDate!: string;
  reason!: string;
  attachmentUrl?: string;
  status!: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  reviewerName?: string;
  reviewerRole?: string;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: LeaveRequestDto) {
    Object.assign(this, partial);
  }
}


