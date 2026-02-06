/**
 * DTO for class section statistics (all assessments for a class)
 */
export class ClassStatisticsDto {
  classSectionId!: string;
  classSectionName!: string;
  totalStudents!: number;
  totalAssessments!: number;
  publishedAssessments!: number;
  unpublishedAssessments!: number;
  overallAverageMarks?: number;
  totalGradesEntered!: number;
  totalGradesPending!: number;

  constructor(partial: Partial<ClassStatisticsDto>) {
    Object.assign(this, partial);
  }
}

