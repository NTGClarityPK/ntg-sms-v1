import type { AbsenceReason, SubstitutionStatus } from './absence-reason.type';

export class SubstitutionDto {
  id!: string;
  branchId!: string;
  academicYearId!: string;
  absentTeacherId!: string;
  absentTeacherName!: string;
  substituteTeacherId!: string;
  substituteTeacherName!: string;
  absenceDate!: string;
  absenceReason!: AbsenceReason;
  timetableSlotId!: string;
  status!: SubstitutionStatus;
  periodLabel?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  startTime?: string;
  endTime?: string;
  notifiedAt?: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<SubstitutionDto>) {
    Object.assign(this, partial);
  }
}

export class AssignSubstitutionsResultDto {
  substitutionIds!: string[];

  constructor(partial: Partial<AssignSubstitutionsResultDto>) {
    Object.assign(this, partial);
  }
}

export class SubstitutionLoadStatDto {
  staffId!: string;
  staffName!: string;
  substitutionCount!: number;
  isOverloaded!: boolean;

  constructor(partial: Partial<SubstitutionLoadStatDto>) {
    Object.assign(this, partial);
  }
}
