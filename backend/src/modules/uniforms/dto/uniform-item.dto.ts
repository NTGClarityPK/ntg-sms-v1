export class UniformItemDto {
  id!: string;
  name!: string;
  itemCode?: string;
  category!: string;
  gender?: string;
  description?: string;
  imageUrl?: string;
  isActive!: boolean;
  branchId!: string;
  createdAt!: string;
  updatedAt!: string;
  stock?: StockEntryDto[];

  constructor(partial: Partial<UniformItemDto>) {
    Object.assign(this, partial);
  }
}

export class StockEntryDto {
  id!: string;
  uniformItemId!: string;
  size!: string;
  quantity!: number;
  lowStockThreshold!: number;
  branchId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<StockEntryDto>) {
    Object.assign(this, partial);
  }
}
