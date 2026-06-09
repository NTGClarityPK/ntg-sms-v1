import type { CertificateType } from '../types/certificate.types';
import { CERTIFICATE_TYPES } from '../types/certificate.types';

export type CertificateSignatureSlotLabels = {
  signature1: string;
  signature2: string;
};

export type CertificateSignatureLabelsByType = Partial<
  Record<CertificateType, Partial<CertificateSignatureSlotLabels>>
>;

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

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

export function resolveSignatureLabelsForType(
  type: CertificateType,
  stored: CertificateSignatureLabelsByType | null | undefined,
): CertificateSignatureSlotLabels {
  const defaults = DEFAULT_CERTIFICATE_SIGNATURE_LABELS[type];
  const row = stored?.[type];
  return {
    signature1: str(row?.signature1) || defaults.signature1,
    signature2: str(row?.signature2) || defaults.signature2,
  };
}

export function normalizeSignatureLabelsByType(
  input: unknown,
): CertificateSignatureLabelsByType {
  if (!input || typeof input !== 'object') return {};
  const out: CertificateSignatureLabelsByType = {};
  for (const type of CERTIFICATE_TYPES) {
    const row = (input as Record<string, unknown>)[type];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const signature1 = str(r.signature1);
    const signature2 = str(r.signature2);
    if (signature1 || signature2) {
      out[type] = {
        ...(signature1 ? { signature1 } : {}),
        ...(signature2 ? { signature2 } : {}),
      };
    }
  }
  return out;
}
