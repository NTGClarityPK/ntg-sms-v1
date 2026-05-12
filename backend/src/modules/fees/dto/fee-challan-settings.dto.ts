import { IsOptional, IsString } from 'class-validator';

export class FeeChallanSettingsDto {
  id!: string;
  branchId!: string;
  challanTemplate!: 'Minimal' | 'Modern';
  bankName!: string | null;
  accountTitle!: string | null;
  accountNumber!: string | null;
  bankBranchCode!: string | null;
  paymentInstructions!: string | null;
  footerText!: string | null;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<FeeChallanSettingsDto>) {
    Object.assign(this, partial);
  }
}

export class UpsertFeeChallanSettingsDto {
  @IsOptional()
  @IsString()
  challanTemplate?: 'Minimal' | 'Modern';

  @IsOptional()
  @IsString()
  bankName?: string | null;

  @IsOptional()
  @IsString()
  accountTitle?: string | null;

  @IsOptional()
  @IsString()
  accountNumber?: string | null;

  @IsOptional()
  @IsString()
  bankBranchCode?: string | null;

  @IsOptional()
  @IsString()
  paymentInstructions?: string | null;

  @IsOptional()
  @IsString()
  footerText?: string | null;
}

