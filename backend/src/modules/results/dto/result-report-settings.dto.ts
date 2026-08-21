import { IsIn, IsOptional } from 'class-validator';

export type PdfVariant = 'minimal' | 'modern';

export class ResultReportSettingsDto {
  id!: string;
  branchId!: string;
  pdfVariant!: PdfVariant;
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
}
