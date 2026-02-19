export class LowAttendanceStudentDto {
  constructor(partial: Partial<LowAttendanceStudentDto>) {
    Object.assign(this, partial);
  }
  studentId!: string;
  studentName!: string;
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  percentage!: number;
  presentDays!: number;
  absentDays!: number;
  totalDays!: number;
  belowThreshold!: number;
}

export class LowAttendanceReportDto {
  constructor(partial: Partial<LowAttendanceReportDto>) {
    Object.assign(this, partial);
  }
  startDate!: string;
  endDate!: string;
  threshold!: number;
  students!: LowAttendanceStudentDto[];
}
