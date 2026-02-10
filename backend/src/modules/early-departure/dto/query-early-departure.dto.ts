import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';
import { EarlyDepartureStatus } from './early-departure-status.type';

export class QueryEarlyDepartureRequestsDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }
    return undefined;
  })
  status?: EarlyDepartureStatus[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}








