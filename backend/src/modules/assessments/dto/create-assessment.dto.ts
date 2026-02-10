import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';

export class CreateAssessmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsUUID('4')
  assessmentTypeId!: string;

  @IsUUID('4')
  subjectId!: string;

  // Option 1: Single class-section (existing, backward compatible)
  @ValidateIf((o) => !o.classId)
  @IsUUID('4')
  classSectionId?: string;

  // Option 2: Class-level with subject template (for all sections)
  @ValidateIf((o) => !o.classSectionId && !o.classSectionIds)
  @IsUUID('4')
  classId?: string;

  @ValidateIf((o) => o.classId && !o.classSectionIds)
  @IsUUID('4')
  subjectTemplateId?: string;

  // Option 3: Class-level with specific sections
  @ValidateIf((o) => o.classId && !o.subjectTemplateId)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  classSectionIds?: string[];

  @IsNumber()
  @IsPositive()
  totalMarks!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  publishDate?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;
}


