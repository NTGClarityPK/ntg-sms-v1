import type { CertificateStatus, CertificateTemplateId, CertificateType } from '../types/certificate.types';
import type { CertificateSignatureLabelsByType } from '../utils/certificate-signature-labels.util';

export class CertificateDto {
  id!: string;
  branchId!: string;
  studentId!: string;
  studentName!: string;
  certificateType!: CertificateType;
  templateId!: CertificateTemplateId;
  certificateNumber!: string;
  certificateData!: Record<string, unknown>;
  issuedBy!: string | null;
  issuedByName!: string | null;
  issuedAt!: string;
  pdfUrl!: string | null;
  status!: CertificateStatus;
  classSectionLabel!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class CertificateDesignDto {
  id!: 'award' | 'administrative';
  label!: string;
  orientation!: 'landscape' | 'portrait';
  certificateTypes!: CertificateType[];
}

export class CertificateSettingsDto {
  branchId!: string;
  schoolLogoUrl!: string | null;
  primaryColor!: string;
  schoolTagline!: string | null;
  principalName!: string | null;
  registrarName!: string | null;
  schoolEstablished!: string | null;
  signatureLabelsByType!: CertificateSignatureLabelsByType;
}
