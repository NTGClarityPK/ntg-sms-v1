import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RatingScaleLevelDto } from './rating-scale-level.dto';

export class UpdateBranchBehavioralConfigDto {
  @IsIn(['star_based', 'framework_based'])
  activeSystem!: 'star_based' | 'framework_based';

  /** Required when switching to framework_based. Must be a branch-owned preset. */
  @IsOptional()
  @IsUUID()
  frameworkPresetId?: string;
}

export class CreateBlankFrameworkPresetDto {
  @IsString()
  @MaxLength(200)
  presetName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  commentsRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RatingScaleLevelDto)
  @ArrayMinSize(1)
  defaultRatingScale?: RatingScaleLevelDto[];
}

export class UpdateFrameworkPresetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  presetName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  commentsRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RatingScaleLevelDto)
  @ArrayMinSize(1)
  defaultRatingScale?: RatingScaleLevelDto[];
}

export class CreateFrameworkCategoryDto {
  @IsString()
  @MaxLength(200)
  categoryName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  indicators?: string[];
}

export class UpdateFrameworkCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  indicators?: string[];
}
