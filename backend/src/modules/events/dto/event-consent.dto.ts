export class EventConsentDto {
  id!: string;
  eventId!: string;
  studentId!: string;
  studentName?: string;
  studentStudentId?: string;
  className?: string;
  sectionName?: string;
  parentUserId!: string;
  parentName?: string;
  status!: 'pending' | 'approved' | 'rejected';
  respondedAt?: string;
  ipAddress?: string;
  notes?: string;
  branchId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<EventConsentDto>) {
    Object.assign(this, partial);
  }
}

