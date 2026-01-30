import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveStatus } from './leave-status.type';

export class UpdateLeaveStatusDto {
  @IsOptional()
  @IsEnum(['approved', 'rejected', 'cancelled'] as const)
  status?: Exclude<LeaveStatus, 'pending'>; // Optional because route determines status (approve/reject/cancel)

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000)
  reviewNotes?: string;
}


