export type ConflictType = 'teacher_double_booking' | 'invalid_school_day' | 'timing_mismatch';

export interface ConflictingSlot {
  id: string;
  classSectionId: string;
  className?: string;
  sectionName?: string;
  startTime: string;
  endTime: string;
}

export class ConflictDto {
  type!: ConflictType;
  message!: string;
  staffId?: string;
  dayOfWeek!: number;
  slotIds: string[] = [];
  conflictingSlots: ConflictingSlot[] = [];

  constructor(partial: Partial<ConflictDto>) {
    Object.assign(this, partial);
  }
}





