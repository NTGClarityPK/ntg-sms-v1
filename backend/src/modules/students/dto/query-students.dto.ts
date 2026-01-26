import { IsOptional, IsString, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryStudentsDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  classId?: string; // Deprecated: use classIds instead for backward compatibility

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
  classIds?: string[];

  @IsOptional()
  @IsString()
  sectionId?: string; // Deprecated: use sectionIds instead for backward compatibility

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
  sectionIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}

