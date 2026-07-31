/** Human-readable staff role label from API role name (e.g. subject_teacher). */
export function formatStaffRoleLabel(roleName: string, displayName?: string): string {
  if (displayName?.trim()) return displayName.trim();
  return roleName
    .trim()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const STAFF_ID_CARD_ROLE_EXCLUDE = new Set(['student', 'parent']);
