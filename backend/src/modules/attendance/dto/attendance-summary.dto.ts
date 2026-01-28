export class AttendanceSummaryDto {
  totalDays!: number;
  presentDays!: number;
  absentDays!: number;
  lateDays!: number;
  excusedDays!: number;
  percentage!: number;

  constructor(partial: Partial<AttendanceSummaryDto>) {
    Object.assign(this, partial);
  }
}



