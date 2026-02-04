export class TimetableSlotDto {
  id!: string;
  classSectionId!: string;
  dayOfWeek!: number;
  /**
   * Optional period label for display. Time range (startTime, endTime) is the
   * primary identifier for ordering and uniqueness.
   */
  periodNumber?: number;
  startTime!: string;
  endTime!: string;
  subjectId?: string;
  staffId?: string;
  room?: string;
  slotType!: 'class' | 'assembly' | 'break' | 'free';
  branchId!: string;
  academicYearId!: string;
  subjectTemplateId?: string;
  createdAt!: string;
  updatedAt!: string;

  // Enriched fields from relations (subjects, staff, classes, sections)
  subjectName?: string;
  staffName?: string;
  className?: string;
  sectionName?: string;

  constructor(partial: Partial<TimetableSlotDto>) {
    Object.assign(this, partial);
  }
}

