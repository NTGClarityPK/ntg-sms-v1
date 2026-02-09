/**
 * DTO for assessment attachment
 */
export class AssessmentAttachmentDto {
  id!: string;
  assessmentId!: string;
  fileName!: string;
  fileUrl!: string;
  fileSizeBytes?: number;
  mimeType?: string;
  createdAt!: string;

  constructor(partial: Partial<AssessmentAttachmentDto>) {
    Object.assign(this, partial);
  }
}

