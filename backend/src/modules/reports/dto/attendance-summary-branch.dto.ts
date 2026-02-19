export class AttendanceSummaryClassItemDto {
  constructor(partial: Partial<AttendanceSummaryClassItemDto>) {
    Object.assign(this, partial);
  }
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  averageAttendance!: number;
  studentCount!: number;
  totalPresent!: number;
  totalAbsent!: number;
  totalLate!: number;
  totalExcused!: number;
}

export class AttendanceSummaryBranchDto {
  constructor(partial: Partial<AttendanceSummaryBranchDto>) {
    Object.assign(this, partial);
  }
  startDate!: string;
  endDate!: string;
  byClass!: AttendanceSummaryClassItemDto[];
  overall!: {
    averageAttendance: number;
    totalStudents: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    totalExcused: number;
  };
}
