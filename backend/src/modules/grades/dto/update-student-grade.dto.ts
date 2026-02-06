import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO for updating a student grade
 */
export class UpdateStudentGradeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsBoolean()
  isExcused?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  remarks?: string;

  @IsOptional()
  @IsDateString()
  submittedAt?: string;
}

