/**
 * Default behavioural assessment attributes (must match backend default list).
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
