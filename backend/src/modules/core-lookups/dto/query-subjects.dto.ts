import { IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QuerySubjectsDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['name', 'code', 'sort_order', 'created_at'])
  sortBy?: 'name' | 'code' | 'sort_order' | 'created_at';
}


