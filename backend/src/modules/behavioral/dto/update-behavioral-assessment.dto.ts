import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BehavioralScoreItemDto } from './behavioral-score-item.dto';

export class UpdateBehavioralAssessmentDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehavioralScoreItemDto)
  @ArrayMinSize(1)
  scores?: BehavioralScoreItemDto[];
}
