/** Canonical import/export column order for students bulk sheets. */
export const STUDENT_BULK_COLUMN_DEFS: Array<{
  key: string;
  label: string;
  example: string;
}> = [
  { key: 'username', label: 'Username', example: 'ahmedali' },
  { key: 'first_name', label: 'First Name', example: 'Ahmed' },
  { key: 'last_name', label: 'Last Name', example: 'Ali' },
  { key: 'gender', label: 'Gender', example: 'male' },
  { key: 'invitation_type', label: 'Invitation Type', example: 'student' },
  {
    key: 'invitation_recipient_email',
    label: 'Invitation Recipient Email (optional)',
    example: 'parent.personal@example.com',
  },
  { key: 'phone', label: 'Phone (optional)', example: '+9647701234567' },
  { key: 'address', label: 'Address (optional)', example: 'Baghdad' },
  { key: 'date_of_birth', label: 'Date of Birth (optional)', example: '2010-05-15' },
  { key: 'blood_group', label: 'Blood Group (optional)', example: 'O+' },
  { key: 'medical_notes', label: 'Medical Notes (optional)', example: 'None' },
  { key: 'admission_date', label: 'Admission Date (optional)', example: '2025-09-01' },
  {
    key: 'google_account_email',
    label: 'Google Account Email (optional)',
    example: 'ahmed.ali@gmail.com',
  },
  { key: 'class_section', label: 'Class-Section (optional)', example: 'Grade 1 - A' },
  {
    key: 'subject_template_name_or_id',
    label: 'Subject Template name or ID (optional)',
    example: 'Primary Curriculum',
  },
  { key: 'create_parent_account', label: 'Create Parent Account', example: 'no' },
  {
    key: 'parent_email',
    label: 'Parent Email (for new parent account)',
    example: 'parent@example.com',
  },
  { key: 'parent_name', label: 'Parent Name (optional)', example: 'Ali Ahmed' },
  { key: 'parent_phone', label: 'Parent Phone (optional)', example: '+9647709876543' },
  {
    key: 'parent_relationship',
    label: 'Parent Relationship (optional)',
    example: 'guardian',
  },
];

export const IMPORT_STATUS_COLUMN = {
  key: 'import_status',
  label: 'Import Status',
} as const;

export type StudentBulkSheetStatus =
  | 'added'
  | 'updated'
  | 'unchanged'
  | 'failed'
  | 'skipped';

export function normalizeImportStatus(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^failed\s*[:\-–—]\s*/i, 'failed');
}

/** Rows already succeeded in a prior import — skip on re-import. */
export function isSkipImportStatus(raw: string | undefined | null): boolean {
  const v = normalizeImportStatus(raw);
  if (!v) return false;
  if (v === 'added' || v === 'updated' || v === 'unchanged' || v === 'skipped') return true;
  // "added" / "updated" with trailing notes
  if (v.startsWith('added') || v.startsWith('updated') || v.startsWith('unchanged')) return true;
  return false;
}

export function isFailedImportStatus(raw: string | undefined | null): boolean {
  const v = normalizeImportStatus(raw);
  return v === 'failed' || v.startsWith('failed');
}
