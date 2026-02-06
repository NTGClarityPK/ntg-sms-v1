export type TimetableSlotType = 'class' | 'assembly' | 'break' | 'free';

export interface TimetableSlot {
  subjectTemplateId?: string;
  id: string;
  classSectionId: string;
  dayOfWeek: number;
  periodNumber?: number; // Optional label - time range is primary identifier
  startTime: string;
  endTime: string;
  subjectId?: string;
  staffId?: string;
  room?: string;
  slotType: TimetableSlotType;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
  // Related data
  subjectName?: string;
  staffName?: string;
  className?: string;
  sectionName?: string;
}

export interface ClassTimetable {
  classSectionId: string;
  className: string;
  sectionName: string;
  slots: TimetableSlot[];
}

export interface FreePeriod {
  dayOfWeek: number;
  periodNumber: number;
}

export interface TeacherTimetable {
  staffId: string;
  staffName: string;
  slots: TimetableSlot[];
  freePeriods: FreePeriod[];
}

export type ConflictType = 'teacher_double_booking' | 'invalid_school_day' | 'timing_mismatch';

export interface ConflictingSlot {
  id: string;
  classSectionId: string;
  className?: string;
  sectionName?: string;
  startTime: string;
  endTime: string;
}

export interface Conflict {
  type: ConflictType;
  message: string;
  staffId?: string;
  dayOfWeek: number;
  slotIds: string[];
  conflictingSlots: ConflictingSlot[];
}

export interface CreateTimetableSlotInput {
  classSectionId: string;
  dayOfWeek: number;
  periodNumber?: number; // Optional label - time range is primary identifier
  startTime: string;
  endTime: string;
  subjectId?: string;
  staffId?: string;
  room?: string;
  slotType: TimetableSlotType;
  academicYearId?: string;
  subjectTemplateId?: string;
}

export interface GenerateTimetableInput {
  classSectionId: string;
  academicYearId?: string;
  subjectTemplateId?: string;
}

export interface ReplicateDayInput {
  classSectionId: string;
  sourceDayOfWeek: number;
  targetDaysOfWeek: number[];
  academicYearId?: string;
  subjectTemplateId?: string;
}

export interface TimingTemplateInfo {
  templateId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  periodDurationMinutes: number;
  slots: Array<{
    name: string;
    startTime: string | null;
    endTime: string | null;
    sortOrder: number;
  }>;
}

