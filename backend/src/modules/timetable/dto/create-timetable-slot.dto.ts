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
  @IsUUID()
  classSectionId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(1)
  periodNumber!: number;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  startTime!: string; // HH:MM format

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  endTime!: string; // HH:MM format

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
}

