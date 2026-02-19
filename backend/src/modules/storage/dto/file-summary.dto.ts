export class FileSummaryDto {
  id!: string;
  source!: 'library' | 'assessment' | 'uniform';
  fileName!: string;
  fileUrl!: string | null;
  fileSizeBytes!: number;
  mimeType?: string | null;
  createdAt?: string | null;
}
