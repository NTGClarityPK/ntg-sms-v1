import { IsInt, Max, Min } from 'class-validator';

export class UpdateSchoolDaysDto {
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  activeDays!: number[];
}


