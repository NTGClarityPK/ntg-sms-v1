import { IsOptional, IsString, IsArray, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';
import { AttendanceStatus } from './create-attendance.dto';

export class QueryAttendanceDto extends BasePaginationDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  classSectionId?: string; // Deprecated: use classSectionIds instead

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return [value];
    }
    return undefined;
  })
  classSectionIds?: string[];

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  status?: string; // Deprecated: use statuses instead

  @IsOptional()
  @IsArray()
  @IsEnum(['present', 'absent', 'late', 'excused'], { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return [value];
    }
    return undefined;
  })
  statuses?: AttendanceStatus[];

  @IsOptional()
  @IsString()
  academicYearId?: string;
}



