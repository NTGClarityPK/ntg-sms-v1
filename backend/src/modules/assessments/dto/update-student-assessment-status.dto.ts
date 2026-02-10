import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import type { StudentAssessmentStatusValue } from './student-assessment-status.dto';

/**
 * DTO for updating a student's assessment status
 */
export class UpdateStudentAssessmentStatusDto {
  @IsOptional()
  @IsEnum(['not_started', 'in_progress', 'submitted'])
  status?: StudentAssessmentStatusValue;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}



