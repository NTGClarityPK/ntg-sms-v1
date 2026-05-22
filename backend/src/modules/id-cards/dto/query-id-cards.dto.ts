import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';
import type { IdCardPersonType, IdCardStatus } from '../types/id-card-person-type';

export class QueryIdCardsDto extends BasePaginationDto {
  @IsOptional()
  @IsIn(['student', 'staff', 'admin', 'visitor'])
  personType?: IdCardPersonType;

  @IsOptional()
  @IsIn(['draft', 'approved', 'printed', 'issued', 'revoked'])
  status?: IdCardStatus;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  missingPhotoOnly?: boolean;
}
