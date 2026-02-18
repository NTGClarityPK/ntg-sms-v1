export class UniformIssuanceDto {
  id!: string;
  studentId!: string;
  studentName?: string;
  uniformItemId!: string;
  uniformItemName?: string;
  size!: string;
  quantity!: number;
  issuedBy!: string;
  issuerName?: string;
  requestId?: string;
  notes?: string;
  branchId!: string;
  issuedAt!: string;

  constructor(partial: Partial<UniformIssuanceDto>) {
    Object.assign(this, partial);
  }
}

export class IssuanceReportRowDto {
  studentId!: string;
  studentName?: string;
  uniformItemId!: string;
  uniformItemName?: string;
  size!: string;
  quantity!: number;
  issuedAt!: string;
  issuerName?: string;

  constructor(partial: Partial<IssuanceReportRowDto>) {
    Object.assign(this, partial);
  }
}
