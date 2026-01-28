export class BranchSummaryDto {
  id!: string;
  tenantId!: string | null;
  name!: string;
  code?: string | null;

  constructor(partial: Partial<BranchSummaryDto>) {
    Object.assign(this, partial);
  }
}






