import type { CertificateType } from '@/types/certificates';

export type CertificateSignatureSlotLabels = {
  signature1: string;
  signature2: string;
};

export type CertificateSignatureLabelsByType = Partial<
  Record<CertificateType, CertificateSignatureSlotLabels>
>;

export const CERTIFICATE_TYPES_FOR_SIGNATURES: CertificateType[] = [
  'sports',
  'academic',
  'promotion',
  'participation',
  'custom',
  'leaving',
  'character',
];

export const DEFAULT_CERTIFICATE_SIGNATURE_LABELS: Record<
  CertificateType,
  CertificateSignatureSlotLabels
> = {
  sports: { signature1: 'Principal', signature2: 'Class Teacher' },
  academic: { signature1: 'Principal', signature2: 'Class Teacher' },
  promotion: { signature1: 'Principal', signature2: 'Class Teacher' },
  participation: { signature1: 'Principal', signature2: 'Class Teacher' },
  custom: { signature1: 'Principal', signature2: 'Class Teacher' },
  leaving: { signature1: 'Registrar', signature2: 'Principal' },
  character: { signature1: 'Registrar', signature2: 'Principal' },
};

export function mergeSignatureLabelsByType(
  stored: CertificateSignatureLabelsByType | null | undefined,
): Record<CertificateType, CertificateSignatureSlotLabels> {
  const out = { ...DEFAULT_CERTIFICATE_SIGNATURE_LABELS };
  if (!stored) return out;
  for (const type of CERTIFICATE_TYPES_FOR_SIGNATURES) {
    const row = stored[type];
    if (!row) continue;
    out[type] = {
      signature1: row.signature1?.trim() || out[type].signature1,
      signature2: row.signature2?.trim() || out[type].signature2,
    };
  }
  return out;
}

export function resolveSignatureLabelsForType(
  type: CertificateType,
  stored: CertificateSignatureLabelsByType | null | undefined,
): CertificateSignatureSlotLabels {
  return mergeSignatureLabelsByType(stored)[type];
}
