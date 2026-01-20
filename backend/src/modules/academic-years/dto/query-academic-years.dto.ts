import { IsIn, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryAcademicYearsDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['name', 'start_date', 'end_date', 'created_at'])
  sortBy?: 'name' | 'start_date' | 'end_date' | 'created_at';
}


