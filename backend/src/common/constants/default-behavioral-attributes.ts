/**
 * Default behavioural assessment attribute labels for new branches (wizard, bulk import, optional system_settings default).
 * Safe to remove or replace in Settings; when assessment is disabled they remain stored but unused.
 */
export const DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES: readonly string[] = [
  'Discipline',
  'Respect & Courtesy',
  'Class Engagement',
  'Work Habits',
  'Extracurriculars',
];

export const DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE = {
  enabled: true,
  mandatory: false,
  attributes: [...DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES],
} as const;
