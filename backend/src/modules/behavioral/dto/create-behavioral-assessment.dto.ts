import {
  IsArray,
  IsDateString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BehavioralScoreItemDto } from './behavioral-score-item.dto';

export class CreateBehavioralAssessmentDto {
  @IsUUID()
  studentId!: string;

  /** First day of assessment month (e.g. 2026-02-01). */
  @IsDateString()
  assessmentMonth!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehavioralScoreItemDto)
  @ArrayMinSize(1)
  scores!: BehavioralScoreItemDto[];
}
