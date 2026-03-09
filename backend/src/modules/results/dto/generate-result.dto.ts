import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { RESULT_TYPES, ResultType } from './result-type.enum';

export class GenerateResultDto {
  @IsUUID('4')
  studentId!: string;

  @IsUUID('4')
  classSectionId!: string;

  @IsUUID('4')
  @IsOptional()
  academicYearId?: string;

  @IsIn(RESULT_TYPES)
  resultType!: ResultType;
}
