import { IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryTimingTemplatesDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['name', 'start_time', 'end_time', 'created_at'])
  sortBy?: 'name' | 'start_time' | 'end_time' | 'created_at';
}


