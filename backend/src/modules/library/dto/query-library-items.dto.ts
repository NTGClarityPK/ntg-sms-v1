import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryLibraryItemsDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  category?: string;

  @IsOptional()
  @IsUUID('4')
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  })
  subjectId?: string;

  @IsOptional()
  @IsUUID('4')
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  })
  classId?: string;
}
