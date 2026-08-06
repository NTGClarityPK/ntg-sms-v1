import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class FrameworkCategoryScoreItemDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MaxLength(20)
  ratingCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherComment?: string;
}

export class CreateFrameworkRatingDto {
  @IsUUID()
  studentId!: string;

  /** First day of assessment month (e.g. 2026-02-01). */
  @IsDateString()
  assessmentMonth!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameworkCategoryScoreItemDto)
  @ArrayMinSize(1)
  categoryScores!: FrameworkCategoryScoreItemDto[];
}

export class UpdateFrameworkRatingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameworkCategoryScoreItemDto)
  @ArrayMinSize(1)
  categoryScores!: FrameworkCategoryScoreItemDto[];
}
