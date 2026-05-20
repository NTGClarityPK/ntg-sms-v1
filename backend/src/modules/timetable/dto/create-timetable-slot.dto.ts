import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum TimetableSlotType {
  CLASS = 'class',
  ASSEMBLY = 'assembly',
  BREAK = 'break',
  FREE = 'free',
}

export class CreateTimetableSlotDto {
  @IsOptional()
  @IsUUID()
  id?: string; // Optional: if provided, update existing slot by ID

  @IsUUID()
  classSectionId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodNumber?: number; // Optional label - time range is primary identifier

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  startTime!: string; // HH:MM format

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  /** Exclusive display end (HH:MM); persisted as inclusive last minute (one minute earlier). */
  endTime!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  room?: string;

  @IsEnum(TimetableSlotType)
  slotType: TimetableSlotType = TimetableSlotType.CLASS;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  subjectTemplateId?: string;
}

