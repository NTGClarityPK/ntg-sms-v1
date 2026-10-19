import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryLateFeesDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @IsString()
  classSectionId?: string;

  @IsOptional()
  @IsIn(['all', 'active', 'waived'])
  status: 'all' | 'active' | 'waived' = 'all';
}
