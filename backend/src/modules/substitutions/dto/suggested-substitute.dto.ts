export class SuggestedSubstituteDto {
  staffId!: string;
  fullName!: string;
  primarySubject?: string;
  freePeriods!: number;
  totalAffectedPeriods!: number;
  substitutionsThisMonth!: number;
  availabilityStatus!: 'available' | 'partial' | 'unavailable';
  isBestMatch!: boolean;
  hasHighLoadWarning!: boolean;
  matchesSubject!: boolean;

  constructor(partial: Partial<SuggestedSubstituteDto>) {
    Object.assign(this, partial);
  }
}

export class SuggestSubstitutionsResultDto {
  absentTeacherId!: string;
  absentTeacherName!: string;
  date!: string;
  endDate?: string;
  totalPeriodAssignments!: number;
  affectedSlots!: AffectedSlotDto[];
  suggested!: SuggestedSubstituteDto[];
  others!: SuggestedSubstituteDto[];

  constructor(partial: Partial<SuggestSubstitutionsResultDto>) {
    Object.assign(this, partial);
  }
}

export class AffectedSlotDto {
  id!: string;
  dayOfWeek!: number;
  startTime!: string;
  endTime!: string;
  periodNumber?: number;
  subjectId?: string;
  subjectName?: string;
  className!: string;
  sectionName!: string;

  constructor(partial: Partial<AffectedSlotDto>) {
    Object.assign(this, partial);
  }
}
