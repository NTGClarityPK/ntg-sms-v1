import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  ResultReportSettingsDto,
  UpsertResultReportSettingsDto,
  type PdfVariant,
} from './dto/result-report-settings.dto';

type ResultReportSettingsRow = {
  id: string;
  branch_id: string;
  pdf_variant: PdfVariant;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function mapRow(row: ResultReportSettingsRow): ResultReportSettingsDto {
  return new ResultReportSettingsDto({
    id: row.id,
    branchId: row.branch_id,
    pdfVariant: row.pdf_variant,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class ResultReportSettingsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async get(branchId: string): Promise<{ data: ResultReportSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('result_report_settings')
      .select('id, branch_id, pdf_variant, created_at, updated_at')
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);

    if (!data) {
      const now = new Date().toISOString();
      return {
        data: new ResultReportSettingsDto({
          id: 'default',
          branchId,
          pdfVariant: 'modern',
          createdAt: now,
          updatedAt: now,
        }),
      };
    }
    return { data: mapRow(data as ResultReportSettingsRow) };
  }

  async upsert(branchId: string, input: UpsertResultReportSettingsDto): Promise<{ data: ResultReportSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();
    const current = await this.get(branchId);
    const payload = {
      branch_id: branchId,
      pdf_variant: input.pdfVariant ?? current.data.pdfVariant,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('result_report_settings')
      .upsert(payload, { onConflict: 'branch_id' })
      .select('id, branch_id, pdf_variant, created_at, updated_at')
      .single();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to save result report settings');
    return { data: mapRow(data as ResultReportSettingsRow) };
  }
}
