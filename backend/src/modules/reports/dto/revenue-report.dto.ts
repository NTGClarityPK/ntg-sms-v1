import type { RevenueSourceKey } from '../revenue/revenue-source.types';

export class RevenueReportSourceDto {
  sourceKey!: RevenueSourceKey;
  enabled!: boolean;
  total!: number;
  transactionCount!: number;
}

export class RevenueReportBranchDto {
  branchId!: string;
  branchName!: string;
  total!: number;
  sources!: Record<RevenueSourceKey, number>;
}

export class RevenuePaymentMethodBreakdownDto {
  methodKey!: string;
  total!: number;
}

export class RevenueFeeLineDto {
  id!: string;
  branchId!: string;
  branchName?: string;
  studentId!: string;
  personName!: string;
  amount!: number;
  paymentDate!: string;
  paymentMethodKey!: string;
  challanNumber?: string;
}

export class RevenueIdCardLineDto {
  id!: string;
  branchId!: string;
  branchName?: string;
  personName!: string;
  personType!: string;
  amount!: number;
  eventDate!: string;
  cardNumber?: string;
  reason?: string;
}

export class RevenueReportDto {
  scope!: 'current' | 'branch' | 'combined';
  startDate!: string;
  endDate!: string;
  grandTotal!: number;
  detailMode!: 'summary' | 'detailed';
  sources!: RevenueReportSourceDto[];
  byBranch!: RevenueReportBranchDto[];
  feeManagement?: { byPaymentMethod: RevenuePaymentMethodBreakdownDto[] };
  feeLines?: RevenueFeeLineDto[];
  idCardLines?: RevenueIdCardLineDto[];
  branding?: {
    schoolName: string;
    branchSubtitle: string;
    logoDataUrl?: string;
  };
}
