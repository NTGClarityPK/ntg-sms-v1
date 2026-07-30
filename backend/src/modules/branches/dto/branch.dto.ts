export class BranchDto {
  id!: string;
  tenantId!: string | null;
  name!: string;
  nameAr?: string | null;
  /** Raw bilingual translations for settings editors. */
  nameTranslations?: { en?: string; ar?: string } | null;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  storageQuotaGb!: number;
  storageUsedBytes!: number;
  isActive!: boolean;
  /** Whether public statistics page is enabled for this branch (password not exposed). */
  publicStatsEnabled?: boolean;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<BranchDto>) {
    Object.assign(this, partial);
  }
}
