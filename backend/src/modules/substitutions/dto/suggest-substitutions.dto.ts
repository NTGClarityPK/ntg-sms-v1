import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SuggestSubstitutionsDto {
  @IsUUID()
  absentTeacherId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
