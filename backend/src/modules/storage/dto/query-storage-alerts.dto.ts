import { IsOptional, IsIn } from 'class-validator';

export class QueryStorageAlertsDto {
  @IsOptional()
  @IsIn(['warning', 'critical', 'exceeded', 'unacknowledged'])
  filter?: 'warning' | 'critical' | 'exceeded' | 'unacknowledged';
}
