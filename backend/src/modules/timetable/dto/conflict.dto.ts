export type ConflictType = 'teacher_double_booking' | 'invalid_school_day' | 'timing_mismatch' | 'class_section_slot_overlap';

export interface ConflictingSlot {
  id: string;
  classSectionId: string;
  className?: string;
  sectionName?: string;
  startTime: string;
  endTime: string;
  /** Subject name for class slots, or assembly / break / free for other slot types */
  slotLabel?: string;
}

export class ConflictDto {
  type!: ConflictType;
  message!: string;
  staffId?: string;
  dayOfWeek!: number;
  slotIds: string[] = [];
  conflictingSlots: ConflictingSlot[] = [];
  subjectTemplateId?: string;
  subjectTemplateName?: string;

  constructor(partial: Partial<ConflictDto>) {
    Object.assign(this, partial);
  }
}





