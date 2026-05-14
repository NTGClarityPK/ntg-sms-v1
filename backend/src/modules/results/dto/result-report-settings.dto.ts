import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type PdfVariant = 'minimal' | 'modern';

export class ResultReportSettingsDto {
  id!: string;
  branchId!: string;
  pdfVariant!: PdfVariant;
  progressMaxAssessments?: number | null;
  progressWindowDays?: number | null;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<ResultReportSettingsDto>) {
    Object.assign(this, partial);
  }
}

export class UpsertResultReportSettingsDto {
  @IsIn(['minimal', 'modern'])
  @IsOptional()
  pdfVariant?: PdfVariant;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  progressMaxAssessments?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  progressWindowDays?: number;
}
