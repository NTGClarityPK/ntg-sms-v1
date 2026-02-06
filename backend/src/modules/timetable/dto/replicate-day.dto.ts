import { IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ReplicateDayDto {
  @IsUUID()
  classSectionId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  sourceDayOfWeek!: number; // Day to copy from

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  targetDaysOfWeek!: number[]; // Days to copy to

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  subjectTemplateId?: string; // Only replicate slots for this template
}

