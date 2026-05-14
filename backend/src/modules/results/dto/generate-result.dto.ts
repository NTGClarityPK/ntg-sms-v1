import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { REPORT_KINDS, type ReportKind } from './report-kind.enum';
import { RESULT_TYPES, ResultType } from './result-type.enum';

export class GenerateResultDto {
  @IsUUID('4')
  studentId!: string;

  @IsUUID('4')
  classSectionId!: string;

  @IsUUID('4')
  @IsOptional()
  academicYearId?: string;

  @IsIn(REPORT_KINDS)
  @IsOptional()
  reportKind?: ReportKind;

  @IsIn(RESULT_TYPES)
  @IsOptional()
  resultType?: ResultType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  progressSequence?: number;
}
