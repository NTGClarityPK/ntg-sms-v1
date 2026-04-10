export class YearCloseReadinessDto {
  academicYearId!: string;
  totalActiveStudents!: number;
  decisionsCompleted!: number;
  decisionsMissing!: number;
  missingStudentIds!: string[];

  constructor(partial: Partial<YearCloseReadinessDto>) {
    Object.assign(this, partial);
  }
}

