import { IsOptional, IsUUID } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QuerySyncHistoryDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID()
  assessmentId?: string;
}
