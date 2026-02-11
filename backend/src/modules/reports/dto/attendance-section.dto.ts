export class AttendanceSectionDto {
  constructor(partial: Partial<AttendanceSectionDto>) {
    Object.assign(this, partial);
  }

  totalDays!: number;
  presentDays!: number;
  absentDays!: number;
  lateDays!: number;
  excusedDays!: number;
  percentage!: number;
}
