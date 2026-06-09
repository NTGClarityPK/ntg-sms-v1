import { IsDateString } from 'class-validator';

export class QuerySubstitutionOverlaysDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
