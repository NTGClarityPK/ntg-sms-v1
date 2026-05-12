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
  created_at: string;
  updated_at: string;
};

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
      .select(
        'id, branch_id, challan_template, bank_name, account_title, account_number, bank_branch_code, payment_instructions, footer_text, created_at, updated_at',
      )
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      };
    }
    return { data: mapRow(data as FeeChallanSettingsRow) };
  }

  async upsert(branchId: string, input: UpsertFeeChallanSettingsDto): Promise<{ data: FeeChallanSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();

    const payload = {
      branch_id: branchId,
      challan_template: input.challanTemplate ?? 'Minimal',
      bank_name: input.bankName ?? null,
      account_title: input.accountTitle ?? null,
      account_number: input.accountNumber ?? null,
      bank_branch_code: input.bankBranchCode ?? null,
      payment_instructions: input.paymentInstructions ?? null,
      footer_text: input.footerText ?? null,
    };

    const { data, error } = await supabase
      .from('fee_challan_settings')
      .upsert(payload, { onConflict: 'branch_id' })
      .select(
        'id, branch_id, challan_template, bank_name, account_title, account_number, bank_branch_code, payment_instructions, footer_text, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to save fee challan settings');
    return { data: mapRow(data as FeeChallanSettingsRow) };
  }
}

