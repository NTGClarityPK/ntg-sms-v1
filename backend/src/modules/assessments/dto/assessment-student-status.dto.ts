/**
 * DTO representing a student's assessment status for statistics views
 */
export class AssessmentStudentStatusDto {
  studentId!: string;
  studentUserId!: string;
  studentName?: string;
  studentStudentId?: string;
  status?: 'not_started' | 'in_progress' | 'submitted';
  isRead!: boolean;
  updatedAt?: string;

  constructor(partial: Partial<AssessmentStudentStatusDto>) {
    Object.assign(this, partial);
  }
}


