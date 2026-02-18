export class LibraryItemDto {
  id!: string;
  title!: string;
  author?: string;
  description?: string;
  subjectId?: string;
  classId?: string;
  category!: string;
  fileUrl!: string;
  fileName!: string;
  fileSizeBytes!: number;
  mimeType!: string;
  thumbnailUrl?: string;
  isActive!: boolean;
  viewCount!: number;
  downloadCount!: number;
  uploadedBy?: string;
  branchId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<LibraryItemDto>) {
    Object.assign(this, partial);
  }
}
