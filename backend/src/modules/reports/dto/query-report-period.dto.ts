import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';

export enum ReportPeriodType {
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class QueryReportPeriodDto {
  @IsOptional()
  @IsEnum(ReportPeriodType)
  periodType?: ReportPeriodType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string; // For week/month - start of the period
}
