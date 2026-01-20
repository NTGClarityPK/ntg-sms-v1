import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryClassesDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID()
  levelId?: string;

  @IsOptional()
  @IsIn(['name', 'display_name', 'sort_order', 'created_at'])
  sortBy?: 'name' | 'display_name' | 'sort_order' | 'created_at';
}


