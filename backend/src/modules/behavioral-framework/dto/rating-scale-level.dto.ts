import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RatingScaleLevelDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(100)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;
}
