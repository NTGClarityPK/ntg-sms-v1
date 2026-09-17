export interface ParentLinkedChild {
  id: string;
  parentUserId: string;
  studentId: string;
  relationship: 'father' | 'mother' | 'guardian';
  isPrimary: boolean;
  canApprove: boolean;
  createdAt: string;
  parentName?: string;
  studentName?: string;
  studentStudentId?: string;
  isActive?: boolean;
  accountStatus?: string;
  classSectionLabel?: string;
}
