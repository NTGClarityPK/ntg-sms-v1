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

export class UpsertRubricScoreItemDto {
  @IsUUID()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marksObtained!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}

export class UpsertStudentRubricScoresDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertRubricScoreItemDto)
  scores!: UpsertRubricScoreItemDto[];
}
