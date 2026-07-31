/** Must match backend allowlist in `messages.service.ts`. */
export const ADMIN_BROADCAST_ROLE_NAMES = [
  'student',
  'parent',
  'class_teacher',
  'subject_teacher',
  'academic_coordinator',
  'guidance_counselor',
  'principal',
  'school_admin',
  'admin_assistant',
] as const;

export type AdminBroadcastRoleName = (typeof ADMIN_BROADCAST_ROLE_NAMES)[number];
