import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { TimetableSlotType } from './create-timetable-slot.dto';

export class UpdateTimetableSlotDto {
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodNumber?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  startTime?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  endTime?: string;

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

  @IsOptional()
  @IsEnum(TimetableSlotType)
  slotType?: TimetableSlotType;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

