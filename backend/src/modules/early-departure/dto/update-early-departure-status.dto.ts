import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EarlyDepartureStatus } from './early-departure-status.type';

export class UpdateEarlyDepartureStatusDto {
  @IsOptional()
  @IsEnum(['approved', 'rejected'] as const)
  status?: Exclude<EarlyDepartureStatus, 'pending' | 'cancelled'>; // Optional because route determines status (approve/reject)

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000)
  reviewNotes?: string;
}


