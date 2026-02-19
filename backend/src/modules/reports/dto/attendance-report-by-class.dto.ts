export class AttendanceReportStudentRowDto {
  constructor(partial: Partial<AttendanceReportStudentRowDto>) {
    Object.assign(this, partial);
  }
  studentId!: string;
  studentName!: string;
  presentDays!: number;
  absentDays!: number;
  lateDays!: number;
  excusedDays!: number;
  totalDays!: number;
  percentage!: number;
}

export class AttendanceReportByClassDto {
  constructor(partial: Partial<AttendanceReportByClassDto>) {
    Object.assign(this, partial);
  }
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  startDate!: string;
  endDate!: string;
  students!: AttendanceReportStudentRowDto[];
  classSummary!: {
    averageAttendance: number;
    studentCount: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    totalExcused: number;
  };
}
