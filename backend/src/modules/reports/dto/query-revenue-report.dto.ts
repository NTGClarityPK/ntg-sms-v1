import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum RevenueReportScope {
  CURRENT = 'current',
  BRANCH = 'branch',
  COMBINED = 'combined',
}

export enum RevenueReportDetailMode {
  SUMMARY = 'summary',
  DETAILED = 'detailed',
}

export class QueryRevenueReportDto {
  @IsEnum(RevenueReportScope)
  scope!: RevenueReportScope;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(RevenueReportDetailMode)
  detail?: RevenueReportDetailMode;

  @IsOptional()
  @IsString()
  locale?: string;
}
