/**
 * DTO for individual student performance summary
 */
export class StudentPerformanceDto {
  studentId!: string;
  studentName!: string;
  totalAssessments!: number;
  gradedAssessments!: number;
  pendingAssessments!: number;
  averageMarks?: number;
  totalMarksObtained?: number;
  totalPossibleMarks?: number;
  percentageScore?: number;

  constructor(partial: Partial<StudentPerformanceDto>) {
    Object.assign(this, partial);
  }
}

