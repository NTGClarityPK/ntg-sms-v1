import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateRubricCategoryDto {
  /** Existing category id — omit for newly added categories. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(200)
  categoryName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryCode?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAssessmentRubricDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateRubricCategoryDto)
  categories!: UpdateRubricCategoryDto[];
}
