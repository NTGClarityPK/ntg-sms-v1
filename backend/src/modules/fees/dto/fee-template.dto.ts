export type FeeTemplateType = 'Fee' | 'Discount';
export type FeeTemplateScope = 'Levels' | 'Class' | 'Class-Section' | 'Individual';
export type FeeProRateType = 'Full_Month' | 'Half_Month' | 'Daily_Pro_Rate';

export type FeeMetricAmountType = 'Absolute' | 'Percentage';
export type FeeCurrencyCode = 'PKR' | 'IQD' | 'SAR' | 'USD';

export class FeeTemplateMetricDto {
  id!: string;
  templateId!: string;
  name!: string;
  amountType!: FeeMetricAmountType;
  amount!: number;
  perDay!: boolean;
  displayOrder!: number;
  createdAt!: string;

  constructor(partial: Partial<FeeTemplateMetricDto>) {
    Object.assign(this, partial);
  }
}

export class FeeTemplateAssignmentDto {
  id!: string;
  scopeType!: 'Level' | 'Class' | 'Section';
  scopeId!: string;
  createdAt!: string;

  constructor(partial: Partial<FeeTemplateAssignmentDto>) {
    Object.assign(this, partial);
  }
}

export class FeeTemplateDto {
  id!: string;
  branchId!: string;
  name!: string;
  type!: FeeTemplateType;
  scope!: FeeTemplateScope;
  currencyCode!: FeeCurrencyCode;
  autoApply!: boolean;
  autoApplyCondition?: Record<string, unknown> | null;
  daysUntilDue!: number;
  proRateType!: FeeProRateType;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
  metrics!: FeeTemplateMetricDto[];
  assignments?: FeeTemplateAssignmentDto[];

  constructor(partial: Partial<FeeTemplateDto>) {
    Object.assign(this, partial);
  }
}

