import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryNotificationsDto extends BasePaginationDto {
  @IsOptional()
  @Transform(({ value }) => {
    // With enableImplicitConversion=true, query params like ?isRead=false may
    // be converted to boolean before this transform runs.
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsString()
  type?: string;
}



