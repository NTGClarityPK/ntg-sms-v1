import { escapeHtmlPdf } from '../id-cards/utils/escape-html.util';
import type { CertificateRenderContext } from './types/certificate.types';
import type { CertificateType } from './types/certificate.types';
import {
  getCertificateTypeTitle,
  isAdministrativeType,
  isAwardType,
} from './utils/certificate-type.util';
import {
  resolveSignatureLabelsForType,
  type CertificateSignatureLabelsByType,
} from './utils/certificate-signature-labels.util';
import { resolveSignatureSlotNames } from './utils/resolve-signature-slot-names.util';

export type CertificateStudentSnapshot = {
  studentName: string;
  parentName: string;
  dateOfBirth: string;
  admissionNumber: string;
  admissionDate: string;
  classLastAttended: string;
  academicSession: string;
  yearsAttended: string;
};

export type CertificateBranchSnapshot = {
  /** Tenant / organisation name (main school heading). */
  tenantName: string;
  /** Branch name (subheading under the school name). */
  branchName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
};

export type CertificateSettingsSnapshot = {
  schoolLogoUrl: string;
  primaryColor: string;
  schoolTagline: string | null;
  principalName: string | null;
  registrarName: string | null;
  schoolEstablished: string | null;
  signatureLabelsByType: CertificateSignatureLabelsByType;
};

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** Default on when omitted (legacy certificates). */
function resolveBooleanFlag(
  data: Record<string, unknown>,
  key: string,
  defaultValue: boolean,
): boolean {
  const raw = data[key];
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === undefined || raw === null) return defaultValue;
  return defaultValue;
}

function resolveShowDistinctionBadge(data: Record<string, unknown>): boolean {
  return resolveBooleanFlag(data, 'showDistinctionBadge', true);
}

function resolveShowCertificateNumber(data: Record<string, unknown>): boolean {
  return resolveBooleanFlag(data, 'showCertificateNumber', true);
}

function buildAwardCitationHtml(
  type: CertificateType,
  data: Record<string, unknown>,
  descriptor: string,
  subject: string,
  academicYearLabel: string,
): string {
  const intro =
    type === 'custom' ? str(data.citationIntro) : 'For demonstrating';
  const showYear =
    type === 'custom'
      ? resolveBooleanFlag(data, 'showCitationAcademicYear', true)
      : true;
  const year =
    type === 'custom' && str(data.citationAcademicYear)
      ? str(data.citationAcademicYear)
      : academicYearLabel;
  const showClosing =
    type === 'custom'
      ? resolveBooleanFlag(data, 'showClosingMessage', true)
      : true;

  const segments: string[] = [];
  let main = '';
  if (intro) main += `${escapeHtmlPdf(intro)} `;
  if (descriptor) main += `<strong>${escapeHtmlPdf(descriptor)}</strong>`;
  if (descriptor && subject) main += ' in ';
  if (subject) main += `<strong>${escapeHtmlPdf(subject)}</strong>`;
  if (showYear && year) {
    main += ` during the academic year <strong>${escapeHtmlPdf(year)}</strong>`;
  }
  main = main.trim();
  if (main) {
    if (!main.endsWith('.')) main += '.';
    segments.push(main);
  }
  if (showClosing) {
    segments.push(
      'Your dedication, hard work, and remarkable achievement bring great pride to our school community.',
    );
  }
  return segments.join('<br />');
}

function buildAwardFields(
  type: CertificateType,
  data: Record<string, unknown>,
): Pick<
  CertificateRenderContext,
  'certificate_subtype' | 'achievement_descriptor' | 'achievement_subject'
> {
  switch (type) {
    case 'sports':
      return {
        certificate_subtype: str(data.competitionLevel) || 'School',
        achievement_descriptor: str(data.achievement),
        achievement_subject: str(data.eventName),
      };
    case 'academic':
      return {
        certificate_subtype: str(data.position) || 'Overall',
        achievement_descriptor: str(data.gradeOrPercentage),
        achievement_subject: str(data.subjectOrOverall) || 'Overall',
      };
    case 'promotion':
      return {
        certificate_subtype: str(data.promotedToClass),
        achievement_descriptor: truncate(str(data.performanceSummary), 120),
        achievement_subject: str(data.academicYear),
      };
    case 'participation':
      return {
        certificate_subtype: str(data.eventDate),
        achievement_descriptor: truncate(str(data.description), 120),
        achievement_subject: str(data.activityName),
      };
    case 'custom':
      return {
        certificate_subtype: str(data.customSubtitle),
        achievement_descriptor: str(data.achievementDescriptor),
        achievement_subject: str(data.achievementSubject),
      };
    default:
      return {
        certificate_subtype: '',
        achievement_descriptor: '',
        achievement_subject: '',
      };
  }
}

function buildDetailsTableRows(
  type: CertificateType,
  student: CertificateStudentSnapshot,
  data: Record<string, unknown>,
): string {
  const row = (label: string, value: string) =>
    `<tr><th>${escapeHtmlPdf(label)}</th><td>${escapeHtmlPdf(value || '—')}</td></tr>`;

  const baseRows = [
    row('Student Name', student.studentName),
    row('Parent / Guardian Name', student.parentName),
    row('Date of Birth', student.dateOfBirth),
    row('Admission Number', student.admissionNumber),
    row('Date of Admission', student.admissionDate),
    row('Class / Grade Last Attended', student.classLastAttended),
    row('Academic Session', student.academicSession),
  ];

  if (type === 'leaving') {
    return [
      ...baseRows,
      row('Date of Leaving', str(data.dateOfLeaving)),
      row('Reason for Leaving', str(data.reasonForLeaving)),
      row('Last School Attended', str(data.lastSchoolAttended)),
      row('Progress', str(data.progress)),
    ].join('');
  }

  const traits = Array.isArray(data.characterTraits)
    ? (data.characterTraits as string[]).join(', ')
    : str(data.characterTraits);

  return [
    ...baseRows,
    row('Years Attended', student.yearsAttended),
    row('Character Traits', traits),
  ].join('');
}

function buildRemarksParagraph(
  type: CertificateType,
  data: Record<string, unknown>,
): string {
  const remarks = str(data.remarks);
  if (type === 'leaving') {
    const progress = str(data.progress);
    const parts = [];
    if (progress) parts.push(`Progress during study was ${escapeHtmlPdf(progress)}.`);
    if (remarks) parts.push(escapeHtmlPdf(remarks));
    return parts.join(' ');
  }
  if (remarks) return escapeHtmlPdf(remarks);
  return '';
}

export function buildCertificateRenderContext(input: {
  certificateType: CertificateType;
  certificateData: Record<string, unknown>;
  student: CertificateStudentSnapshot;
  branch: CertificateBranchSnapshot;
  settings: CertificateSettingsSnapshot;
  academicYearLabel: string;
  classTeacherName: string;
  certificateNumber: string;
  issueDate: string;
  isRevoked?: boolean;
}): CertificateRenderContext {
  const customTagline = input.settings.schoolTagline?.trim();
  const schoolTagline = customTagline || input.branch.branchName;

  const ctx: CertificateRenderContext = {
    school_name: input.branch.tenantName,
    school_tagline: schoolTagline,
    school_address: input.branch.schoolAddress,
    school_phone: input.branch.schoolPhone,
    school_email: input.branch.schoolEmail,
    school_logo_url: input.settings.schoolLogoUrl,
    school_established: input.settings.schoolEstablished?.trim() || '—',
    certificate_type:
      input.certificateType === 'custom'
        ? str(input.certificateData.customTitle) || 'Certificate'
        : getCertificateTypeTitle(input.certificateType),
    student_name: input.student.studentName,
    parent_name: input.student.parentName,
    date_of_birth: input.student.dateOfBirth,
    admission_number: input.student.admissionNumber,
    admission_date: input.student.admissionDate,
    class_last_attended: input.student.classLastAttended,
    academic_session: input.student.academicSession,
    academic_year: input.academicYearLabel,
    principal_name: input.settings.principalName?.trim() || '',
    registrar_name: input.settings.registrarName?.trim() || '',
    class_teacher_name: input.classTeacherName?.trim() || '',
    certificate_no: input.certificateNumber,
    issue_date: input.issueDate,
    conduct: str(input.certificateData.conduct) || 'Good',
    verification_url: '',
    isRevoked: !!input.isRevoked,
    isLeaving: input.certificateType === 'leaving',
    isCharacter: input.certificateType === 'character',
    details_table_rows: '',
    remarks_paragraph: '',
  };

  ctx.showCertificateNumber = resolveShowCertificateNumber(input.certificateData);

  const signatureLabels = resolveSignatureLabelsForType(
    input.certificateType,
    input.settings.signatureLabelsByType,
  );
  ctx.signature1_label = signatureLabels.signature1;
  ctx.signature2_label = signatureLabels.signature2;
  const slotNames = resolveSignatureSlotNames(
    input.certificateType,
    input.certificateData,
    input.settings,
    input.classTeacherName,
  );
  ctx.signature1_name = slotNames.signature1Name;
  ctx.signature2_name = slotNames.signature2Name;

  if (isAwardType(input.certificateType)) {
    const awardFields = buildAwardFields(
      input.certificateType,
      input.certificateData,
    );
    Object.assign(ctx, awardFields);
    ctx.showDistinctionBadge = resolveShowDistinctionBadge(input.certificateData);
    ctx.citation_html = buildAwardCitationHtml(
      input.certificateType,
      input.certificateData,
      str(awardFields.achievement_descriptor),
      str(awardFields.achievement_subject),
      input.academicYearLabel,
    );
  }

  if (isAdministrativeType(input.certificateType)) {
    ctx.details_table_rows = buildDetailsTableRows(
      input.certificateType,
      input.student,
      input.certificateData,
    );
    ctx.remarks_paragraph = buildRemarksParagraph(
      input.certificateType,
      input.certificateData,
    );
  }

  return ctx;
}
