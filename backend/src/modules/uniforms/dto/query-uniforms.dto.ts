import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryUniformsDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['shirt', 'pants', 'skirt', 'shoes', 'accessories'])
  @Transform(({ value }) => (Array.isArray(value) ? value[0] : value))
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'unisex'])
  @Transform(({ value }) => (Array.isArray(value) ? value[0] : value))
  gender?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
