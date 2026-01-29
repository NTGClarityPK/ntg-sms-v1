export class LeaveQuotaDto {
  totalQuota!: number;
  usedDays!: number;
  remainingDays!: number;

  constructor(partial: LeaveQuotaDto) {
    Object.assign(this, partial);
  }
}


