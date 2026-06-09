export type CertificateType =
  | 'sports'
  | 'academic'
  | 'promotion'
  | 'participation'
  | 'custom'
  | 'leaving'
  | 'character';

export type CertificateTemplateId = 'award' | 'administrative';

export type CertificateStatus = 'draft' | 'issued' | 'revoked';

export type Certificate = {
  id: string;
  branchId: string;
  studentId: string;
  studentName: string;
  certificateType: CertificateType;
  templateId: CertificateTemplateId;
  certificateNumber: string;
  certificateData: Record<string, unknown>;
  issuedBy: string | null;
  issuedByName: string | null;
  issuedAt: string;
  pdfUrl: string | null;
  status: CertificateStatus;
  classSectionLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CertificateDesign = {
  id: CertificateTemplateId;
  label: string;
  orientation: 'landscape' | 'portrait';
  certificateTypes: CertificateType[];
};

export type CertificateSettings = {
  branchId: string;
  schoolLogoUrl: string | null;
  primaryColor: string;
  schoolTagline: string | null;
  principalName: string | null;
  registrarName: string | null;
  schoolEstablished: string | null;
  signatureLabelsByType: CertificateSignatureLabelsByType;
};

export type CertificateSignatureSlotLabels = {
  signature1: string;
  signature2: string;
};

export type CertificateSignatureLabelsByType = Partial<
  Record<CertificateType, CertificateSignatureSlotLabels>
>;

export type IssueCertificateInput = {
  studentId: string;
  certificateType: CertificateType;
  certificateData: Record<string, unknown>;
};

export type GeneratePreviewInput = IssueCertificateInput;

export type CertificateIssueFormDefaults = {
  signature1Name: string;
  signature2Name: string;
  signature1Label: string;
  signature2Label: string;
};
