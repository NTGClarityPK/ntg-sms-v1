import { IsIn, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';
import { CERTIFICATE_STATUSES, CERTIFICATE_TYPES } from '../types/certificate.types';

export class QueryCertificateHistoryDto extends BasePaginationDto {
  @IsOptional()
  @IsIn([...CERTIFICATE_TYPES])
  type?: (typeof CERTIFICATE_TYPES)[number];

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsIn([...CERTIFICATE_STATUSES])
  status?: (typeof CERTIFICATE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
