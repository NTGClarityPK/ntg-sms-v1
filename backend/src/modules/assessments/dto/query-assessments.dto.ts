import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export type AssessmentPublishStatus = 'all' | 'published' | 'unpublished';

export class QueryAssessmentsDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID('4')
  classSectionId?: string;

  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @IsOptional()
  @IsUUID('4')
  assessmentTypeId?: string;

  @IsOptional()
  @IsEnum(['all', 'published', 'unpublished'])
  status?: AssessmentPublishStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}


