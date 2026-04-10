import { IsBoolean, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CarryForwardDto {
  @IsOptional()
  @IsBoolean()
  teacherAssignments?: boolean;

  @IsOptional()
  @IsBoolean()
  timetableSlots?: boolean;

  @IsOptional()
  @IsBoolean()
  leaveSettings?: boolean;
}

export class RolloverAcademicYearDto {
  @IsUUID()
  targetAcademicYearId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CarryForwardDto)
  carryForward?: CarryForwardDto;
}

