import { IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QuerySubjectTemplatesDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['name', 'created_at', 'updated_at'])
  sortBy?: 'name' | 'created_at' | 'updated_at';
}

