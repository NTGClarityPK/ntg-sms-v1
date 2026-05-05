import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

/** Query for published term-examination assessments (examination schedule). */
export class QueryExaminationScheduleDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID('4')
  academicYearId?: string;

  /** Used by PDF export (validated globally with forbidNonWhitelisted). */
  @IsOptional()
  @IsIn(['en', 'en-GB', 'en-US', 'ar'])
  language?: string;

  @IsOptional()
  @IsUUID('4')
  classSectionId?: string;

  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
