export class TimetableSlotDto {
  id!: string;
  classSectionId!: string;
  dayOfWeek!: number;
  periodNumber!: number;
  startTime!: string;
  endTime!: string;
  subjectId?: string;
  staffId?: string;
  room?: string;
  slotType!: 'class' | 'assembly' | 'break' | 'free';
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;
  // Related data (from joins)
  subjectName?: string;
  staffName?: string;
  className?: string;
  sectionName?: string;

  constructor(partial: Partial<TimetableSlotDto>) {
    Object.assign(this, partial);
  }
}

