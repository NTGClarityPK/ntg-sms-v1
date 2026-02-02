import { IsOptional, IsUUID } from 'class-validator';

export class GenerateTimetableDto {
  @IsUUID()
  classSectionId!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

