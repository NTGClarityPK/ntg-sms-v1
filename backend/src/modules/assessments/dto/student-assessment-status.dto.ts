export type StudentAssessmentStatusValue = 'not_started' | 'in_progress' | 'submitted';

/**
 * DTO representing a student's status for a specific assessment
 */
export class StudentAssessmentStatusDto {
  assessmentId!: string;
  studentId!: string;
  status!: StudentAssessmentStatusValue;
  isRead!: boolean;
  updatedAt!: string;

  constructor(partial: Partial<StudentAssessmentStatusDto>) {
    Object.assign(this, partial);
  }
}



