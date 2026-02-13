export class LeaveQuotaDto {
  totalQuota!: number;
  usedDays!: number;
  remainingDays!: number;
  /** Days counted from absences (marked absent in attendance, auto-created as approved leave). */
  daysFromAbsences!: number;

  constructor(partial: LeaveQuotaDto) {
    Object.assign(this, partial);
  }
}


