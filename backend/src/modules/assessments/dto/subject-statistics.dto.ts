/**
 * DTO for subject statistics (all assessments for a subject)
 */
export class SubjectStatisticsDto {
  subjectId!: string;
  subjectName!: string;
  totalAssessments!: number;
  publishedAssessments!: number;
  averageMarksAcrossAssessments?: number;
  highestAverageMarks?: number;
  lowestAverageMarks?: number;

  constructor(partial: Partial<SubjectStatisticsDto>) {
    Object.assign(this, partial);
  }
}


