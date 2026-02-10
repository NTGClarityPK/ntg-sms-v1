import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * DTO for creating a single student grade
 */
export class CreateStudentGradeDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  assessmentId!: string;

  @IsNumber()
  @Min(0)
  marksObtained!: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isExcused?: boolean = false;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  remarks?: string;

  @IsOptional()
  @IsDateString()
  submittedAt?: string;
}


