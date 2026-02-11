export class ClassReportStudentDto {
  constructor(partial: Partial<ClassReportStudentDto>) {
    Object.assign(this, partial);
  }

  studentId!: string;
  studentName!: string;
  presentDays!: number;
  totalDays!: number;
  attendancePercentage!: number;
  averagePercentage?: number; // average marks percentage across subjects
}

export class ClassReportDto {
  constructor(partial: Partial<ClassReportDto>) {
    Object.assign(this, partial);
  }

  classSectionId!: string;
  className!: string;
  sectionName!: string;
  academicYearId!: string;
  students!: ClassReportStudentDto[];
}
