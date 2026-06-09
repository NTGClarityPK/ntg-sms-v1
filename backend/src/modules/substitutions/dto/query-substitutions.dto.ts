import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';
import type { SubstitutionStatus } from './absence-reason.type';

const STATUSES: SubstitutionStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export class QuerySubstitutionsDto extends BasePaginationDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: SubstitutionStatus;
}
