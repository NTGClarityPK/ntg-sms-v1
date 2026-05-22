const STAFF_ROLE_PRIORITY = [
  'principal',
  'academic_coordinator',
  'school_admin',
  'class_teacher',
  'subject_teacher',
  'guidance_counselor',
  'admin_assistant',
] as const;

export function formatStaffRoleDisplayName(roleName: string): string {
  return roleName
    .trim()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Uppercase badge text with a line break between role words (max two lines). */
export function formatStaffRoleBadgeHtml(displayName: string): string {
  const words = displayName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join('<br>');
  const mid = Math.ceil(words.length / 2);
  return `${words.slice(0, mid).join(' ')}<br>${words.slice(mid).join(' ')}`;
}

export function pickPrimaryStaffRoleName(roleNames: string[]): string {
  const normalized = roleNames.map((n) => n.toLowerCase());
  for (const preferred of STAFF_ROLE_PRIORITY) {
    const idx = normalized.indexOf(preferred);
    if (idx >= 0) return roleNames[idx];
  }
  return roleNames[0] ?? 'staff';
}

export function formatStaffJoinDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const m = iso.trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}
