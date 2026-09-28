/** Canonical import/export column order for parent–student mapping bulk sheets. */
export const PARENT_ASSOCIATION_BULK_COLUMN_DEFS: Array<{
  key: string;
  label: string;
  example: string;
}> = [
  { key: 'username', label: 'Username', example: 'ahmed.ali' },
  { key: 'first_name', label: 'First Name', example: 'Ahmed' },
  { key: 'last_name', label: 'Last Name', example: 'Ali' },
  { key: 'student_id', label: 'Student ID', example: 'STU-001' },
  { key: 'guardian1_email', label: 'Guardian 1 Email', example: 'father@example.com' },
  { key: 'guardian1_name', label: 'Guardian 1 Name', example: 'Ali Hassan' },
  { key: 'guardian1_phone', label: 'Guardian 1 Phone', example: '+9647701234567' },
  {
    key: 'guardian1_relationship',
    label: 'Guardian 1 Relationship',
    example: 'father',
  },
  { key: 'guardian2_email', label: 'Guardian 2 Email', example: 'mother@example.com' },
  { key: 'guardian2_name', label: 'Guardian 2 Name', example: 'Sara Hassan' },
  { key: 'guardian2_phone', label: 'Guardian 2 Phone', example: '+9647707654321' },
  {
    key: 'guardian2_relationship',
    label: 'Guardian 2 Relationship',
    example: 'mother',
  },
];

export const PARENT_ASSOCIATION_IMPORT_STATUS_COLUMN = {
  key: 'import_status',
  label: 'Import Status',
} as const;

export const PARENT_ASSOCIATION_COLUMN_MAP: Record<string, string[]> = {
  username: ['username', 'user name', 'login', 'student username'],
  first_name: ['first_name', 'first name', 'firstname'],
  last_name: ['last_name', 'last name', 'lastname'],
  student_id: ['student_id', 'student id', 'studentid', 'admission number'],
  guardian1_email: [
    'guardian1_email',
    'guardian 1 email',
    'parent1 email',
    'parent 1 email',
    'guardian email',
  ],
  guardian1_name: [
    'guardian1_name',
    'guardian 1 name',
    'parent1 name',
    'parent 1 name',
    'guardian name',
  ],
  guardian1_phone: [
    'guardian1_phone',
    'guardian 1 phone',
    'parent1 phone',
    'parent 1 phone',
  ],
  guardian1_relationship: [
    'guardian1_relationship',
    'guardian 1 relationship',
    'parent1 relationship',
    'parent 1 relationship',
    'relationship',
  ],
  guardian2_email: [
    'guardian2_email',
    'guardian 2 email',
    'parent2 email',
    'parent 2 email',
  ],
  guardian2_name: [
    'guardian2_name',
    'guardian 2 name',
    'parent2 name',
    'parent 2 name',
  ],
  guardian2_phone: [
    'guardian2_phone',
    'guardian 2 phone',
    'parent2 phone',
    'parent 2 phone',
  ],
  guardian2_relationship: [
    'guardian2_relationship',
    'guardian 2 relationship',
    'parent2 relationship',
    'parent 2 relationship',
  ],
  import_status: ['import_status', 'import status', 'status'],
};

export function isSkipParentAssociationImportStatus(status: string | undefined): boolean {
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  return s === 'added' || s === 'updated' || s === 'unchanged';
}
