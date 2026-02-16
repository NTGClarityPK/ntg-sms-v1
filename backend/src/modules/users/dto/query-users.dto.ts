import { IsOptional, IsString, IsArray, IsUUID, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryUsersDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  role?: string; // Deprecated: use roles instead for backward compatibility

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @Transform(({ value }) => {
    // Handle both single value and array from query params
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return [value];
    }
    return undefined;
  })
  roles?: string[];

  @IsOptional()
  @IsString()
  branch?: string;

  /** Query param: 'true' | 'false'. Kept as string so NestJS never converts 'false' to boolean true. */
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;
}

