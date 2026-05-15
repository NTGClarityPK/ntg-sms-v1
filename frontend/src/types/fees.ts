export type FeeTemplateType = 'Fee' | 'Discount';
export type FeeTemplateScope = 'Levels' | 'Class' | 'Class-Section' | 'Individual';
export type FeeMetricAmountType = 'Absolute' | 'Percentage';
export type FeeCurrencyCode = 'PKR' | 'IQD' | 'SAR' | 'USD';

export interface FeeTemplateMetric {
  id: string;
  templateId: string;
  name: string;
  amountType: FeeMetricAmountType;
  amount: number;
  perDay: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface FeeTemplate {
  id: string;
  branchId: string;
  name: string;
  type: FeeTemplateType;
  scope: FeeTemplateScope;
  currencyCode: FeeCurrencyCode;
  autoApply: boolean;
  autoApplyCondition?: Record<string, unknown> | null;
  daysUntilDue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metrics: FeeTemplateMetric[];
  assignments?: Array<{
    id: string;
    scopeType: 'Level' | 'Class' | 'Section';
    scopeId: string;
    createdAt: string;
  }>;
}

export interface FeeChallanSettings {
  challanTemplate?: 'Minimal' | 'Modern';
  bankName: string | null;
  accountTitle: string | null;
  accountNumber: string | null;
  bankBranchCode: string | null;
  paymentInstructions: string | null;
  footerText: string | null;
}

export interface FeeChallanGenerateResult {
  studentId: string;
  challanId: string;
  challanNumber: string;
  pdfUrl: string | null;
}

export type FeeChallanMetricEditAction = 'exclude' | 'overrideAmount';

export interface FeeChallanMetricEdit {
  templateId: string;
  metricId: string;
  action: FeeChallanMetricEditAction;
  amount?: number;
}

export type FeeChallanTemplateEditAction = 'exclude';

export interface FeeChallanTemplateEdit {
  templateId: string;
  action: FeeChallanTemplateEditAction;
}

export interface FeeChallanPreviewRequest {
  month: string; // YYYY-MM
  includeIndividualTemplateIds?: string[];
  metricEdits?: FeeChallanMetricEdit[];
  templateEdits?: FeeChallanTemplateEdit[];
}

export interface FeeStudentTemplateMetric {
  id: string;
  name: string;
  amountType: FeeMetricAmountType;
  amount: number;
  perDay: boolean;
  displayOrder: number;
  isExcluded: boolean;
}

export interface FeeStudentTemplate {
  id: string;
  name: string;
  type: FeeTemplateType;
  scope: FeeTemplateScope;
  daysUntilDue: number;
  autoApply: boolean;
  autoApplyCondition?: Record<string, unknown> | null;
  source: 'Inherited' | 'Individual' | 'Auto';
  linkId?: string | null;
  linkStartDate?: string | null;
  linkEndDate?: string | null;
  metrics: FeeStudentTemplateMetric[];
}

export interface FeeMetricExclusion {
  id: string;
  templateId: string;
  metricId: string;
  reason?: string | null;
  excludedBy: string;
  createdAt: string;
}

export interface FeeCalculationLineItem {
  templateId: string;
  metricId?: string | null;
  description: string;
  itemType: FeeTemplateType;
  amount: number;
  isDiscount: boolean;
  displayOrder: number;
}

export interface FeeCalculationPreview {
  month: string;
  subtotal: number;
  totalDiscount: number;
  lateFees: number;
  payableAmount: number;
  items: FeeCalculationLineItem[];
}

export interface FeeStudentTemplatesResponse {
  templates: FeeStudentTemplate[];
  exclusions: FeeMetricExclusion[];
  preview?: FeeCalculationPreview;
}

