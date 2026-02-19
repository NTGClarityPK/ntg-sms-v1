export class SubjectClassPerformanceDto {
  constructor(partial: Partial<SubjectClassPerformanceDto>) {
    Object.assign(this, partial);
  }
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  averagePercentage!: number;
  studentCount!: number;
  topPerformers!: Array<{ studentId: string; studentName: string; percentage: number }>;
  struggling!: Array<{ studentId: string; studentName: string; percentage: number }>;
}

export class AcademicReportBySubjectDto {
  constructor(partial: Partial<AcademicReportBySubjectDto>) {
    Object.assign(this, partial);
  }
  subjectId!: string;
  subjectName!: string;
  academicYearId!: string;
  byClass!: SubjectClassPerformanceDto[];
}
