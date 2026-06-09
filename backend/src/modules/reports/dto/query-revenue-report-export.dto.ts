import { IsIn, IsOptional } from 'class-validator';
import { QueryRevenueReportDto } from './query-revenue-report.dto';

export class QueryRevenueReportExportDto extends QueryRevenueReportDto {
  @IsOptional()
  @IsIn(['pdf', 'excel'])
  format?: string;
}
