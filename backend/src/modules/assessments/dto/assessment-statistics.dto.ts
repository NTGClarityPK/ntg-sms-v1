/**
 * DTO for assessment statistics (submission and grading progress)
 */
export class AssessmentStatisticsDto {
  assessmentId!: string;
  assessmentTitle!: string;
  totalStudents!: number;
  gradedCount!: number;
  ungradedCount!: number;
  absentCount!: number;
  excusedCount!: number;
  averageMarks?: number;
  highestMarks?: number;
  lowestMarks?: number;
  submissionRate!: number; // Percentage
  completionRate!: number; // Percentage

  constructor(partial: Partial<AssessmentStatisticsDto>) {
    Object.assign(this, partial);
  }
}


