export type AbsenceReason = 'sick_leave' | 'casual_leave' | 'emergency' | 'other';

export type SubstitutionStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export const ABSENCE_REASONS: AbsenceReason[] = [
  'sick_leave',
  'casual_leave',
  'emergency',
  'other',
];
