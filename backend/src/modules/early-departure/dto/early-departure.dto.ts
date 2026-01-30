import { EarlyDepartureStatus } from './early-departure-status.type';

export class EarlyDepartureRequestDto {
  id!: string;
  studentId!: string;
  requestedBy!: string;
  date!: string;
  departureTime!: string;
  reason?: string;
  attachmentUrl?: string;
  status!: EarlyDepartureStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  reviewerName?: string;
  reviewerRole?: string;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: EarlyDepartureRequestDto) {
    Object.assign(this, partial);
  }
}


