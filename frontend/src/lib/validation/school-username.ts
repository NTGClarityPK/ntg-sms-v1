/**
 * Local part of school login email (`username@tenant-domain`).
 * Letters, numbers, full stop and underscore only (no spaces).
 */
export const SCHOOL_USERNAME_LOCAL_PART_REGEX = /^[a-z0-9._]+$/i;

export function isValidSchoolUsernameLocalPart(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && SCHOOL_USERNAME_LOCAL_PART_REGEX.test(trimmed);
}
