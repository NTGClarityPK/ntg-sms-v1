export class ParentStudentDto {
  id!: string;
  parentUserId!: string;
  studentId!: string;
  relationship!: 'father' | 'mother' | 'guardian';
  isPrimary!: boolean;
  canApprove!: boolean;
  createdAt!: string;
  // Joined data
  parentName?: string;
  studentName?: string;
  studentStudentId?: string;

  constructor(partial: Partial<ParentStudentDto>) {
    Object.assign(this, partial);
  }
}

