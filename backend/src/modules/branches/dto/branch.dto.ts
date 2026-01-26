export class BranchDto {
  id!: string;
  tenantId!: string | null;
  name!: string;
  nameAr?: string | null;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  storageQuotaGb!: number;
  storageUsedBytes!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<BranchDto>) {
    Object.assign(this, partial);
  }
}




