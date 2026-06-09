import { IsDateString } from 'class-validator';

export class QuerySubstitutionLoadStatsDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
