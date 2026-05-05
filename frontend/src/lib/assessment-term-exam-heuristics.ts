/**
 * Heuristic: name looks like a mid/final term exam but may not be flagged as a term examination.
 * Used for setup wizard warning only (non-blocking).
 */
export function assessmentTypeNameSuggestsTermExam(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const n = trimmed.toLowerCase().replace(/-/g, ' ');
  const compact = n.replace(/\s+/g, '');
  if (compact.includes('midterm') || n.includes('mid term')) return true;
  if (compact.includes('finalterm') || n.includes('final term')) return true;
  if (/\bmid\b/.test(n)) return true;
  if (/\bfinal\b/.test(n)) return true;
  return false;
}

export function wizardAssessmentTypesNeedTermExamBanner(
  types: Array<{ name: string; isTermExamination?: boolean }>,
): boolean {
  return types.some((t) => !t.isTermExamination && assessmentTypeNameSuggestsTermExam(t.name));
}
