import { UniformRequestItemDto } from './uniform-request-item.dto';
import type { UniformRequestStatus } from './uniform-request-status.type';

export class UniformRequestDto {
  id!: string;
  studentId!: string;
  studentName?: string;
  requestedBy!: string;
  requesterName?: string;
  status!: UniformRequestStatus;
  notes?: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  issuedBy?: string;
  issuedAt?: string;
  branchId!: string;
  createdAt!: string;
  updatedAt!: string;
  items!: UniformRequestItemDto[];

  constructor(partial: Partial<UniformRequestDto>) {
    Object.assign(this, partial);
  }
}
