import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdateAcademicYearDatesDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}
