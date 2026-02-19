export interface StorageOverview {
  quotaGb: number;
  usedBytes: number;
  usedPercentage: number;
}

export interface StorageCategory {
  category: string;
  bytesUsed: number;
  fileCount: number;
}

export interface StorageBreakdown {
  categories: StorageCategory[];
  totalBytes: number;
  totalFiles: number;
}

export interface FileSummary {
  id: string;
  source: 'library' | 'assessment' | 'uniform';
  fileName: string;
  fileUrl: string | null;
  fileSizeBytes: number;
  mimeType?: string | null;
  createdAt?: string | null;
}

export interface StorageAlert {
  id: string;
  branchId: string;
  alertType: 'warning' | 'critical' | 'exceeded';
  percentageUsed: number;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}
