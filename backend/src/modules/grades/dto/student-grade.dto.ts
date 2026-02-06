import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * DTO representing a student grade for an assessment
 */
export class StudentGradeDto {
  id!: string;
  studentId!: string;
  assessmentId!: string;
  marksObtained!: number;
  isAbsent!: boolean;
  isExcused!: boolean;
  @IsOptional()
  @IsString()
  remarks?: string;
  @IsOptional()
  @IsDateString()
  submittedAt?: string;
  gradedBy!: string;
  gradedAt!: string;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<StudentGradeDto>) {
    Object.assign(this, partial);
  }
}

