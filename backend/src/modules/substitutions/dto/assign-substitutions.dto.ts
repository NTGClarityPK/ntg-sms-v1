import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { ABSENCE_REASONS, type AbsenceReason } from './absence-reason.type';

export class AssignSubstitutionsDto {
  @IsUUID()
  absentTeacherId!: string;

  @IsUUID()
  substituteTeacherId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  timetableSlotIds!: string[];

  @IsIn(ABSENCE_REASONS)
  absenceReason!: AbsenceReason;
}
