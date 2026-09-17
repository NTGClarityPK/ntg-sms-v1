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
  firstName?: string;
  lastName?: string;
  studentStudentId?: string;
  parentPhone?: string; // Phone number from profiles table
  parentEmail?: string; // Email from auth.users
  /** Enrolment flag from students.is_active */
  isActive?: boolean;
  /** Portal account status when the student has a linked user */
  accountStatus?: string;
  /** Class × section label for parent identity view */
  classSectionLabel?: string;

  constructor(partial: Partial<ParentStudentDto>) {
    Object.assign(this, partial);
  }
}

