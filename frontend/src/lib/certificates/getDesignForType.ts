import type { CertificateTemplateId, CertificateType } from '@/types/certificates';

const AWARD_TYPES: CertificateType[] = [
  'sports',
  'academic',
  'promotion',
  'participation',
  'custom',
];

export function getDesignForType(type: CertificateType): CertificateTemplateId {
  return AWARD_TYPES.includes(type) ? 'award' : 'administrative';
}

export function isAwardCertificateType(type: CertificateType): boolean {
  return AWARD_TYPES.includes(type);
}

export function isLeavingCertificateType(type: CertificateType): boolean {
  return type === 'leaving';
}
