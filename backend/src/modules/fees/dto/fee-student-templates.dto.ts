export class FeeStudentTemplateMetricDto {
  id!: string;
  name!: string;
  amountType!: 'Absolute' | 'Percentage';
  amount!: number;
  perDay!: boolean;
  displayOrder!: number;
  isExcluded!: boolean;

  constructor(partial: Partial<FeeStudentTemplateMetricDto>) {
    Object.assign(this, partial);
  }
}

export class FeeStudentTemplateDto {
  id!: string;
  name!: string;
  type!: 'Fee' | 'Discount';
  scope!: 'Levels' | 'Class' | 'Class-Section' | 'Individual';
  proRateType!: 'Full_Month' | 'Half_Month' | 'Daily_Pro_Rate';
  daysUntilDue!: number;
  autoApply!: boolean;
  autoApplyCondition?: Record<string, unknown> | null;
  source!: 'Inherited' | 'Individual' | 'Auto';
  linkId?: string | null;
  linkStartDate?: string | null;
  linkEndDate?: string | null;
  metrics!: FeeStudentTemplateMetricDto[];

  constructor(partial: Partial<FeeStudentTemplateDto>) {
    Object.assign(this, partial);
  }
}

export class FeeMetricExclusionDto {
  id!: string;
  templateId!: string;
  metricId!: string;
  reason?: string | null;
  excludedBy!: string;
  createdAt!: string;

  constructor(partial: Partial<FeeMetricExclusionDto>) {
    Object.assign(this, partial);
  }
}

export class FeeCalculationLineItemDto {
  templateId!: string;
  metricId?: string | null;
  description!: string;
  itemType!: 'Fee' | 'Discount';
  amount!: number; // fee positive, discount negative
  isDiscount!: boolean;
  displayOrder!: number;

  constructor(partial: Partial<FeeCalculationLineItemDto>) {
    Object.assign(this, partial);
  }
}

export class FeeCalculationPreviewDto {
  month!: string; // YYYY-MM
  subtotal!: number;
  totalDiscount!: number;
  lateFees!: number;
  payableAmount!: number;
  items!: FeeCalculationLineItemDto[];

  constructor(partial: Partial<FeeCalculationPreviewDto>) {
    Object.assign(this, partial);
  }
}

export class FeeStudentTemplatesResponseDto {
  templates!: FeeStudentTemplateDto[];
  exclusions!: FeeMetricExclusionDto[];
  preview?: FeeCalculationPreviewDto;

  constructor(partial: Partial<FeeStudentTemplatesResponseDto>) {
    Object.assign(this, partial);
  }
}

