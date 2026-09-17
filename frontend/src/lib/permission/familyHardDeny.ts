/**
 * Audience locks for permission matrix + sidebar.
 * Parent/student must never get staff features; operational staff (not SA/P) must
 * never get family-personal features. Matrix cells stay visible but disabled.
 */

export const FAMILY_ROLE_NAMES = ['parent', 'student'] as const;

/** Operational staff — family-personal matrix cells locked (SA/P exempt). */
export const OPERATIONAL_STAFF_ROLE_NAMES = [
  'academic_coordinator',
  'admin_assistant',
  'class_teacher',
  'subject_teacher',
  'guidance_counselor',
] as const;

/** Non-teaching operational staff — also locked out of teacher/family schedule & personal events. */
export const NON_TEACHER_OPERATIONAL_STAFF_ROLE_NAMES = [
  'academic_coordinator',
  'admin_assistant',
  'guidance_counselor',
] as const;

export const TEACHER_OPERATIONAL_STAFF_ROLE_NAMES = [
  'class_teacher',
  'subject_teacher',
] as const;

/** SA/P exempt from staff-side family locks (sidebar parent gates still apply). */
export const PRIVILEGED_STAFF_ROLE_NAMES = ['school_admin', 'principal'] as const;

/** Feature codes locked to none for both parent and student. */
export const FAMILY_HARD_DENIED_FEATURE_CODES: readonly string[] = [
  'students',
  'user_management',
  'staff',
  'class_sections',
  'teacher_mapping',
  'parent_associations',
  'assessment',
  'behavioral',
  'inventory',
  'id_cards',
  'events_management',
  'events',
  'timetable_management',
  'timetable',
  'conflict_management',
  'teacher_substitution',
  'promotion_placement',
  'results',
  'settings',
];

/** Extra locks: parent must not get student-personal features. */
export const PARENT_HARD_DENIED_FEATURE_CODES: readonly string[] = [
  'my_assessments',
  'timetable_personal',
  'my_timetable',
  'my_schedule',
];

/** Extra locks: student must not get teacher-personal schedule. */
export const STUDENT_HARD_DENIED_FEATURE_CODES: readonly string[] = ['my_schedule'];

/** Family-personal features operational staff must never hold (SA/P exempt). */
export const OPERATIONAL_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES: readonly string[] = [
  'my_assessments',
];

/** Non-teacher operational staff: no personal timetable / my-events matrix grants. */
export const NON_TEACHER_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES: readonly string[] = [
  'timetable_personal',
  'my_timetable',
  'my_schedule',
  'events_personal',
  'my_events',
];

/** Sidebar hrefs never shown to family audience (staff admin tabs). */
export const FAMILY_HARD_DENIED_NAV_HREFS: readonly string[] = [
  '/students',
  '/users',
  '/academic/class-sections',
  '/mapping',
  '/assessments',
  '/behavioral',
  '/inventory',
  '/id-cards',
  '/certificates',
  '/events',
  '/timetable',
  '/conflict-management',
  '/substitution',
  '/promotion-placement',
  '/results',
  '/admin/storage',
  '/settings',
  '/billing',
  '/my-schedule',
];

/** Parent/student-only sidebar hrefs — hidden from operational staff (not SA/P). */
export const STAFF_HARD_DENIED_FAMILY_NAV_HREFS: readonly string[] = [
  '/my-children',
  '/my-report-cards',
  '/parent/pin-management',
  '/children-timetable',
  '/uniform-request',
  '/my-assessments',
  '/my-timetable',
  '/my-certificates',
];

function normalizeRole(roleName: string | null | undefined): string {
  return (roleName ?? '').toLowerCase();
}

export function isFamilyRoleName(roleName: string | null | undefined): boolean {
  const n = normalizeRole(roleName);
  return n === 'parent' || n === 'student';
}

export function isPrivilegedStaffRoleName(roleName: string | null | undefined): boolean {
  return PRIVILEGED_STAFF_ROLE_NAMES.includes(
    normalizeRole(roleName) as (typeof PRIVILEGED_STAFF_ROLE_NAMES)[number],
  );
}

export function isOperationalStaffRoleName(roleName: string | null | undefined): boolean {
  return OPERATIONAL_STAFF_ROLE_NAMES.includes(
    normalizeRole(roleName) as (typeof OPERATIONAL_STAFF_ROLE_NAMES)[number],
  );
}

export function isFeatureHardDeniedForFamilyRole(
  roleName: string | null | undefined,
  featureCode: string | null | undefined,
): boolean {
  const role = normalizeRole(roleName);
  const code = featureCode ?? '';
  if (!code || (role !== 'parent' && role !== 'student')) return false;
  if (FAMILY_HARD_DENIED_FEATURE_CODES.includes(code)) return true;
  if (role === 'parent' && PARENT_HARD_DENIED_FEATURE_CODES.includes(code)) return true;
  if (role === 'student' && STUDENT_HARD_DENIED_FEATURE_CODES.includes(code)) return true;
  return false;
}

/** Matrix: family-personal features locked for operational staff (SA/P exempt). */
export function isFeatureHardDeniedForOperationalStaffRole(
  roleName: string | null | undefined,
  featureCode: string | null | undefined,
): boolean {
  const role = normalizeRole(roleName);
  const code = featureCode ?? '';
  if (!code || isPrivilegedStaffRoleName(role)) return false;
  if (!isOperationalStaffRoleName(role)) return false;
  if (OPERATIONAL_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES.includes(code)) return true;
  if (
    NON_TEACHER_STAFF_HARD_DENIED_FAMILY_FEATURE_CODES.includes(code) &&
    NON_TEACHER_OPERATIONAL_STAFF_ROLE_NAMES.includes(
      role as (typeof NON_TEACHER_OPERATIONAL_STAFF_ROLE_NAMES)[number],
    )
  ) {
    return true;
  }
  return false;
}

/** Permission matrix cell disabled when either audience lock applies. */
export function isPermissionMatrixCellLocked(
  roleName: string | null | undefined,
  featureCode: string | null | undefined,
): boolean {
  return (
    isFeatureHardDeniedForFamilyRole(roleName, featureCode) ||
    isFeatureHardDeniedForOperationalStaffRole(roleName, featureCode)
  );
}

export function isFamilyHardDeniedNavHref(href: string): boolean {
  return FAMILY_HARD_DENIED_NAV_HREFS.includes(href);
}

export function isStaffHardDeniedFamilyNavHref(href: string): boolean {
  return STAFF_HARD_DENIED_FAMILY_NAV_HREFS.includes(href);
}

/**
 * Hide parent/student portal tabs from operational staff. SA/P exempt.
 * Pure parent/student audiences are handled separately on the caller side.
 */
export function shouldHideFamilyNavFromOperationalStaff(
  roleNames: readonly string[],
  href: string,
): boolean {
  if (!isStaffHardDeniedFamilyNavHref(href)) return false;
  const normalized = roleNames.map(normalizeRole);
  if (normalized.some(isPrivilegedStaffRoleName)) return false;
  if (normalized.includes('parent') || normalized.includes('student')) return false;
  return normalized.some(isOperationalStaffRoleName);
}
