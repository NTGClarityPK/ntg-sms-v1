import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { FeeChallanSettingsDto, UpsertFeeChallanSettingsDto } from './dto/fee-challan-settings.dto';

type FeeChallanSettingsRow = {
  id: string;
  branch_id: string;
  challan_template: 'Minimal' | 'Modern';
  bank_name: string | null;
  account_title: string | null;
  account_number: string | null;
  bank_branch_code: string | null;
  payment_instructions: string | null;
  footer_text: string | null;
  late_fees_enabled: boolean;
  late_fee_template_id: string | null;
  created_at: string;
  updated_at: string;
};

const SETTINGS_SELECT =
  'id, branch_id, challan_template, bank_name, account_title, account_number, bank_branch_code, payment_instructions, footer_text, late_fees_enabled, late_fee_template_id, created_at, updated_at';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function mapRow(row: FeeChallanSettingsRow): FeeChallanSettingsDto {
  return new FeeChallanSettingsDto({
    id: row.id,
    branchId: row.branch_id,
    challanTemplate: row.challan_template,
    bankName: row.bank_name,
    accountTitle: row.account_title,
    accountNumber: row.account_number,
    bankBranchCode: row.bank_branch_code,
    paymentInstructions: row.payment_instructions,
    footerText: row.footer_text,
    lateFeesEnabled: !!row.late_fees_enabled,
    lateFeeTemplateId: row.late_fee_template_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class FeeChallanSettingsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async get(branchId: string): Promise<{ data: FeeChallanSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challan_settings')
      .select(SETTINGS_SELECT)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);

    if (!data) {
      return {
        data: new FeeChallanSettingsDto({
          id: 'default',
          branchId,
          challanTemplate: 'Minimal',
          bankName: null,
          accountTitle: null,
          accountNumber: null,
          bankBranchCode: null,
          paymentInstructions: null,
          footerText: null,
          lateFeesEnabled: false,
          lateFeeTemplateId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      };
    }
    return { data: mapRow(data as FeeChallanSettingsRow) };
  }

  async upsert(branchId: string, input: UpsertFeeChallanSettingsDto): Promise<{ data: FeeChallanSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();

    const lateFeeTemplateId =
      input.lateFeeTemplateId === undefined
        ? undefined
        : input.lateFeeTemplateId === '' || input.lateFeeTemplateId === null
          ? null
          : input.lateFeeTemplateId;

    if (lateFeeTemplateId) {
      const { data: tpl, error: tplErr } = await supabase
        .from('fee_templates')
        .select('id, type, is_active')
        .eq('id', lateFeeTemplateId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(tplErr);
      if (!tpl) throw new BadRequestException('Late fee package not found');
      const row = tpl as { type: string; is_active: boolean };
      if (row.type !== 'Fee') throw new BadRequestException('Late fee package must be a Fee template');
      if (!row.is_active) throw new BadRequestException('Late fee package must be active');
    }

    const existing = await this.get(branchId);
    const payload: Record<string, unknown> = {
      branch_id: branchId,
      challan_template: input.challanTemplate ?? existing.data.challanTemplate ?? 'Minimal',
      bank_name: input.bankName !== undefined ? input.bankName : existing.data.bankName,
      account_title: input.accountTitle !== undefined ? input.accountTitle : existing.data.accountTitle,
      account_number: input.accountNumber !== undefined ? input.accountNumber : existing.data.accountNumber,
      bank_branch_code: input.bankBranchCode !== undefined ? input.bankBranchCode : existing.data.bankBranchCode,
      payment_instructions:
        input.paymentInstructions !== undefined ? input.paymentInstructions : existing.data.paymentInstructions,
      footer_text: input.footerText !== undefined ? input.footerText : existing.data.footerText,
      late_fees_enabled:
        input.lateFeesEnabled !== undefined ? !!input.lateFeesEnabled : existing.data.lateFeesEnabled,
      late_fee_template_id:
        lateFeeTemplateId !== undefined ? lateFeeTemplateId : existing.data.lateFeeTemplateId,
    };

    if (payload.late_fees_enabled && !payload.late_fee_template_id) {
      throw new BadRequestException('Select a late fee package before enabling late fees');
    }

    const { data, error } = await supabase
      .from('fee_challan_settings')
      .upsert(payload, { onConflict: 'branch_id' })
      .select(SETTINGS_SELECT)
      .single();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to save fee challan settings');
    return { data: mapRow(data as FeeChallanSettingsRow) };
  }
}
