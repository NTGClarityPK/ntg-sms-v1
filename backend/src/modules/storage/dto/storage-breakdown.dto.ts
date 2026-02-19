export class StorageCategoryDto {
  category!: string;
  bytesUsed!: number;
  fileCount!: number;
}

export class StorageBreakdownDto {
  categories!: StorageCategoryDto[];
  totalBytes!: number;
  totalFiles!: number;
}
