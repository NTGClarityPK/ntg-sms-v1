export type AbsenceReason = 'sick_leave' | 'casual_leave' | 'emergency' | 'other';

export type SubstitutionStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type AvailabilityStatus = 'available' | 'partial' | 'unavailable';

export interface AffectedSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  periodNumber?: number;
  subjectId?: string;
  subjectName?: string;
  className: string;
  sectionName: string;
}

export interface SuggestedSubstitute {
  staffId: string;
  fullName: string;
  primarySubject?: string;
  freePeriods: number;
  totalAffectedPeriods: number;
  substitutionsThisMonth: number;
  availabilityStatus: AvailabilityStatus;
  isBestMatch: boolean;
  hasHighLoadWarning: boolean;
  matchesSubject: boolean;
}

export interface SuggestSubstitutionsResult {
  absentTeacherId: string;
  absentTeacherName: string;
  date: string;
  endDate?: string;
  totalPeriodAssignments: number;
  affectedSlots: AffectedSlot[];
  suggested: SuggestedSubstitute[];
  others: SuggestedSubstitute[];
}

export interface Substitution {
  id: string;
  branchId: string;
  academicYearId: string;
  absentTeacherId: string;
  absentTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  absenceDate: string;
  absenceReason: AbsenceReason;
  timetableSlotId: string;
  status: SubstitutionStatus;
  periodLabel?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  startTime?: string;
  endTime?: string;
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignSubstitutionsResult {
  substitutionIds: string[];
}

export interface SubstitutionLoadStat {
  staffId: string;
  staffName: string;
  substitutionCount: number;
  isOverloaded: boolean;
}

export interface SubstitutionOverlay {
  substitutionId: string;
  timetableSlotId: string;
  absenceDate: string;
  absentTeacherId: string;
  absentTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
}

export interface SuggestSubstitutionsInput {
  absentTeacherId: string;
  date: string;
  endDate?: string;
}

export interface AssignSubstitutionsInput {
  absentTeacherId: string;
  substituteTeacherId: string;
  date: string;
  endDate?: string;
  timetableSlotIds: string[];
  absenceReason: AbsenceReason;
}
