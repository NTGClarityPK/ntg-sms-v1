import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, IsUrl, IsUUID } from 'class-validator';

export class CreateAssessmentAttachmentDto {
  @IsUUID('4')
  assessmentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  mimeType?: string;
}



