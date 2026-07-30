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
import { CreateRubricPresetCategoryDto } from './create-rubric-preset.dto';

export class UpdateRubricPresetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  presetName?: string;

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
