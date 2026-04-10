import { IsOptional, IsUUID } from 'class-validator';

export class QueryPromotionStudentsDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;
}

