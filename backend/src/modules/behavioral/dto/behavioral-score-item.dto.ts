import { IsInt, IsString, Min, Max, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Single attribute score for behavioral assessment (1-5 stars).
 */
export class BehavioralScoreItemDto {
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  attributeName!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}
