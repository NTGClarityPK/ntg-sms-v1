import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRubricPresetCategoryDto {
  @IsString()
  @MaxLength(200)
  categoryName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateRubricPresetDto {
  @IsString()
  @MaxLength(200)
  presetName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  presetCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRubricPresetCategoryDto)
  categories!: CreateRubricPresetCategoryDto[];
}
