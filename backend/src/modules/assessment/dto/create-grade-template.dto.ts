import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateGradeRangeInputDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  letter!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateGradeTemplateDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGradeRangeInputDto)
  ranges!: CreateGradeRangeInputDto[];
}


