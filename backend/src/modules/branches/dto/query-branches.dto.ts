import { IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryBranchesDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['name', 'code', 'created_at'])
  sortBy?: 'name' | 'code' | 'created_at';
}






