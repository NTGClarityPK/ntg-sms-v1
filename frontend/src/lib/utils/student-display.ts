/**
 * Prefer human-readable student id (e.g. "00056") from API; never show internal UUID in UI/exports.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function displayStudentId(studentIdNumber: string | undefined, studentId: string): string {
  if (studentIdNumber && studentIdNumber.trim()) return studentIdNumber;
  if (UUID_RE.test(studentId)) return 'N/A';
  return studentId;
}
