import { IsIn, IsObject, IsUUID } from 'class-validator';
import { CERTIFICATE_TYPES } from '../types/certificate.types';

export class IssueCertificateDto {
  @IsUUID()
  studentId!: string;

  @IsIn([...CERTIFICATE_TYPES])
  certificateType!: (typeof CERTIFICATE_TYPES)[number];

  @IsObject()
  certificateData!: Record<string, unknown>;
}

export class GeneratePreviewDto {
  @IsUUID()
  studentId!: string;

  @IsIn([...CERTIFICATE_TYPES])
  certificateType!: (typeof CERTIFICATE_TYPES)[number];

  @IsObject()
  certificateData!: Record<string, unknown>;
}
