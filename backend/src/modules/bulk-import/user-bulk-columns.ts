/** Canonical import/export column order for users bulk sheets. */
export const USER_BULK_COLUMN_DEFS: Array<{
  key: string;
  label: string;
  example: string;
}> = [
  { key: 'full_name', label: 'Full Name', example: 'Sara Ahmed' },
  { key: 'roles', label: 'Roles', example: 'Subject Teacher' },
  { key: 'username', label: 'Username (staff)', example: 'sara.ahmed' },
  {
    key: 'invitation_email',
    label: 'Invitation Email (staff, optional)',
    example: 'sara.personal@example.com',
  },
  { key: 'email', label: 'Email (parent)', example: 'parent@example.com' },
  { key: 'phone', label: 'Phone (optional)', example: '+9647701234567' },
  { key: 'gender', label: 'Gender (optional)', example: 'female' },
  { key: 'date_of_birth', label: 'Date of Birth (optional)', example: '1990-05-15' },
  { key: 'address', label: 'Address (optional)', example: 'Baghdad' },
];

export const USER_IMPORT_STATUS_COLUMN = {
  key: 'import_status',
  label: 'Import Status',
} as const;
