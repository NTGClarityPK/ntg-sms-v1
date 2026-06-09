export const CERTIFICATE_TYPES = [
  'sports',
  'academic',
  'promotion',
  'participation',
  'custom',
  'leaving',
  'character',
] as const;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TEMPLATE_IDS = ['award', 'administrative'] as const;
export type CertificateTemplateId = (typeof CERTIFICATE_TEMPLATE_IDS)[number];

export const CERTIFICATE_STATUSES = ['draft', 'issued', 'revoked'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const AWARD_CERTIFICATE_TYPES: CertificateType[] = [
  'sports',
  'academic',
  'promotion',
  'participation',
  'custom',
];

export const ADMINISTRATIVE_CERTIFICATE_TYPES: CertificateType[] = [
  'leaving',
  'character',
];

export const TERMINAL_ENROLMENT_STATUSES = [
  'transferred_out',
  'withdrawn',
  'graduated',
] as const;

export type CertificateRenderContext = Record<string, string | boolean>;
