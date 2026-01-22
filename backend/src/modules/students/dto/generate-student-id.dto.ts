import { IsUUID, IsOptional } from 'class-validator';

export class GenerateStudentIdDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

