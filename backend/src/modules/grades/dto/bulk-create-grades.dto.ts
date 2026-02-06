import { Type } from 'class-transformer';
import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { CreateStudentGradeDto } from './create-student-grade.dto';

/**
 * DTO for bulk grade entry (multiple students for one assessment)
 */
export class BulkCreateGradesDto {
  @IsUUID()
  assessmentId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentGradeDto)
  grades!: CreateStudentGradeDto[];
}

