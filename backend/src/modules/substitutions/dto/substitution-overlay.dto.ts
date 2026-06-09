export class SubstitutionOverlayDto {
  substitutionId!: string;
  timetableSlotId!: string;
  absenceDate!: string;
  absentTeacherId!: string;
  absentTeacherName!: string;
  substituteTeacherId!: string;
  substituteTeacherName!: string;

  constructor(partial: Partial<SubstitutionOverlayDto>) {
    Object.assign(this, partial);
  }
}
