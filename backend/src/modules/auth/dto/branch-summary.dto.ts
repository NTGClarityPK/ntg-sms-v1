export class BranchSummaryDto {
  id!: string;
  tenantId!: string | null;
  name!: string;
  code?: string | null;
  /** Tenant default UI language for this branch's school. */
  tenantDefaultLocale?: string | null;

  constructor(partial: Partial<BranchSummaryDto>) {
    Object.assign(this, partial);
  }
}
