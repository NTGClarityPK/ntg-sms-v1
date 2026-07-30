export class RubricPresetCategoryDto {
  id!: string;
  categoryName!: string;
  categoryCode?: string;
  defaultMarks?: number;
  sortOrder!: number;
  description?: string;

  constructor(partial: Partial<RubricPresetCategoryDto>) {
    Object.assign(this, partial);
  }
}

export class RubricPresetDto {
  id!: string;
  presetName!: string;
  presetCode?: string;
  description?: string;
  isGlobal!: boolean;
  isActive!: boolean;
  branchId?: string;
  categories!: RubricPresetCategoryDto[];
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<RubricPresetDto>) {
    Object.assign(this, partial);
  }
}
