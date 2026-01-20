import { IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QuerySectionsDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['name', 'sort_order', 'created_at'])
  sortBy?: 'name' | 'sort_order' | 'created_at';
}


