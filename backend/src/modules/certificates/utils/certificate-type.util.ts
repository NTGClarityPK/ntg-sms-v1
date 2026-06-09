import {
  ADMINISTRATIVE_CERTIFICATE_TYPES,
  AWARD_CERTIFICATE_TYPES,
  type CertificateTemplateId,
  type CertificateType,
} from '../types/certificate.types';

export function getTemplateIdForType(type: CertificateType): CertificateTemplateId {
  if (AWARD_CERTIFICATE_TYPES.includes(type)) return 'award';
  if (ADMINISTRATIVE_CERTIFICATE_TYPES.includes(type)) return 'administrative';
  throw new Error(`Unknown certificate type: ${type}`);
}

export function isAwardType(type: CertificateType): boolean {
  return AWARD_CERTIFICATE_TYPES.includes(type);
}

export function isAdministrativeType(type: CertificateType): boolean {
  return ADMINISTRATIVE_CERTIFICATE_TYPES.includes(type);
}

export function getCertificateTypeTitle(type: CertificateType): string {
  const titles: Record<CertificateType, string> = {
    sports: 'Sports Achievement',
    academic: 'Academic Excellence',
    promotion: 'Promotion',
    participation: 'Participation',
    custom: 'Custom Certificate',
    leaving: 'School Leaving Certificate',
    character: 'Character Certificate',
  };
  return titles[type];
}
