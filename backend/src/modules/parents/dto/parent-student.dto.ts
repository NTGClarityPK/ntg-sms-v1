export class ParentStudentDto {
  id!: string;
  parentUserId!: string;
  studentId!: string;
  relationship!: 'father' | 'mother' | 'guardian';
  isPrimary!: boolean;
  canApprove!: boolean;
  priority?: number; // 1 = Primary guardian, 2 = Secondary guardian
  createdAt!: string;
  // Joined data
  parentName?: string;
  studentName?: string;
  studentStudentId?: string;
  parentPhone?: string; // Phone number from profiles table
  parentEmail?: string; // Email from auth.users

  constructor(partial: Partial<ParentStudentDto>) {
    Object.assign(this, partial);
  }
}

