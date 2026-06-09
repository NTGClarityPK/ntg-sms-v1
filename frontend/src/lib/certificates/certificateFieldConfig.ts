import type { CertificateType } from '@/types/certificates';
import { isAwardCertificateType } from '@/lib/certificates/getDesignForType';

export type CertificateFieldKind =
  | 'text'
  | 'textarea'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox';

export type CertificateFieldDef = {
  key: string;
  kind: CertificateFieldKind;
  required?: boolean;
  optionsKey?: 'conduct' | 'progress' | 'competitionLevel' | 'subjectOrOverall' | 'characterTraits';
};

const SHOW_CERTIFICATE_NUMBER_FIELD: CertificateFieldDef = {
  key: 'showCertificateNumber',
  kind: 'checkbox',
};

const AWARD_OPTION_FIELDS: CertificateFieldDef[] = [
  { key: 'showDistinctionBadge', kind: 'checkbox' },
  SHOW_CERTIFICATE_NUMBER_FIELD,
];

/** Editable names above signature lines at issue time (stored in certificate_data). */
export const ISSUE_SIGNATURE_NAME_FIELDS: CertificateFieldDef[] = [
  { key: 'signature1Name', kind: 'text' },
  { key: 'signature2Name', kind: 'text' },
];

export const CERTIFICATE_FIELD_CONFIG: Record<CertificateType, CertificateFieldDef[]> = {
  leaving: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    SHOW_CERTIFICATE_NUMBER_FIELD,
    { key: 'dateOfLeaving', kind: 'date', required: true },
    { key: 'lastSchoolAttended', kind: 'text' },
    { key: 'reasonForLeaving', kind: 'text', required: true },
    { key: 'conduct', kind: 'select', required: true, optionsKey: 'conduct' },
    { key: 'progress', kind: 'select', optionsKey: 'progress' },
    { key: 'remarks', kind: 'textarea' },
  ],
  character: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    SHOW_CERTIFICATE_NUMBER_FIELD,
    { key: 'conduct', kind: 'select', required: true, optionsKey: 'conduct' },
    { key: 'characterTraits', kind: 'multiselect', optionsKey: 'characterTraits' },
    { key: 'remarks', kind: 'textarea' },
  ],
  sports: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    ...AWARD_OPTION_FIELDS,
    { key: 'eventName', kind: 'text', required: true },
    { key: 'achievement', kind: 'text', required: true },
    { key: 'eventDate', kind: 'date', required: true },
    { key: 'competitionLevel', kind: 'select', optionsKey: 'competitionLevel' },
  ],
  academic: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    ...AWARD_OPTION_FIELDS,
    { key: 'subjectOrOverall', kind: 'select', optionsKey: 'subjectOrOverall' },
    { key: 'gradeOrPercentage', kind: 'text', required: true },
    { key: 'position', kind: 'text' },
    { key: 'academicYear', kind: 'text', required: true },
  ],
  promotion: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    ...AWARD_OPTION_FIELDS,
    { key: 'promotedToClass', kind: 'text', required: true },
    { key: 'academicYear', kind: 'text', required: true },
    { key: 'performanceSummary', kind: 'textarea' },
  ],
  participation: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    ...AWARD_OPTION_FIELDS,
    { key: 'activityName', kind: 'text', required: true },
    { key: 'eventDate', kind: 'date', required: true },
    { key: 'description', kind: 'textarea' },
  ],
  custom: [
    ...ISSUE_SIGNATURE_NAME_FIELDS,
    ...AWARD_OPTION_FIELDS,
    { key: 'certificateNumberOverride', kind: 'text' },
    { key: 'customTitle', kind: 'text', required: true },
    { key: 'customSubtitle', kind: 'text' },
    { key: 'achievementDescriptor', kind: 'text', required: true },
    { key: 'achievementSubject', kind: 'text', required: true },
    { key: 'citationIntro', kind: 'text' },
    { key: 'showCitationAcademicYear', kind: 'checkbox' },
    { key: 'citationAcademicYear', kind: 'text' },
    { key: 'showClosingMessage', kind: 'checkbox' },
  ],
};

/** Form values sent as certificate_data (camelCase keys match backend mapper). */
export function toCertificateDataPayload(
  type: CertificateType,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload = { ...values };
  if (payload.showCertificateNumber === undefined) {
    payload.showCertificateNumber = true;
  }
  if (isAwardCertificateType(type) && payload.showDistinctionBadge === undefined) {
    payload.showDistinctionBadge = true;
  }
  return payload;
}

export type DefaultCertificateFormContext = {
  /** Active academic year display name (e.g. 2025–2026). */
  academicYearName?: string;
};

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function academicYearLabel(context?: DefaultCertificateFormContext): string {
  const name = context?.academicYearName?.trim();
  return name && name.length > 0 ? name : '2025–2026';
}

/** Default form values when starting a new certificate for a student. */
export function defaultCertificateFormValues(
  type: CertificateType,
  context?: DefaultCertificateFormContext,
): Record<string, unknown> {
  const base: Record<string, unknown> = { showCertificateNumber: true };
  const year = academicYearLabel(context);
  const today = todayIsoDate();

  if (type === 'custom') {
    return {
      ...base,
      showDistinctionBadge: true,
      customTitle: 'Sports Achievement',
      customSubtitle: 'School',
      achievementDescriptor: 'Man of the Match',
      achievementSubject: 'Sports Day',
      citationIntro: 'For demonstrating',
      showCitationAcademicYear: true,
      citationAcademicYear: year,
      showClosingMessage: true,
    };
  }

  if (type === 'sports') {
    return {
      ...base,
      showDistinctionBadge: true,
      eventName: 'Sports Day',
      achievement: 'Man of the Match',
      competitionLevel: 'School',
      eventDate: today,
    };
  }

  if (type === 'academic') {
    return {
      ...base,
      showDistinctionBadge: true,
      subjectOrOverall: 'Overall',
      gradeOrPercentage: '95%',
      position: '1st',
      academicYear: year,
    };
  }

  if (type === 'promotion') {
    return {
      ...base,
      showDistinctionBadge: true,
      promotedToClass: 'Class III',
      academicYear: year,
      performanceSummary: 'Satisfactory progress throughout the academic year.',
    };
  }

  if (type === 'participation') {
    return {
      ...base,
      showDistinctionBadge: true,
      activityName: 'Annual Sports Day',
      eventDate: today,
      description: 'Active participation and enthusiastic contribution.',
    };
  }

  if (isAwardCertificateType(type)) {
    return { ...base, showDistinctionBadge: true };
  }

  return base;
}

function fieldHasValue(field: CertificateFieldDef, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (field.kind === 'multiselect') {
    return Array.isArray(value) && value.length > 0;
  }
  if (field.kind === 'checkbox') return true;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/** True when all required fields for the certificate type have values (enables live preview). */
export function areCertificateFieldsComplete(
  type: CertificateType,
  values: Record<string, unknown>,
): boolean {
  return CERTIFICATE_FIELD_CONFIG[type]
    .filter((field) => field.required)
    .every((field) => fieldHasValue(field, values[field.key]));
}
