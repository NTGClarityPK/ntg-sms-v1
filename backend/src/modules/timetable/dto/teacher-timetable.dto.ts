import { TimetableSlotDto } from './timetable-slot.dto';

export interface FreePeriod {
  dayOfWeek: number;
  periodNumber: number;
}

export class TeacherTimetableDto {
  staffId!: string;
  staffName!: string;
  slots: TimetableSlotDto[] = [];
  freePeriods: FreePeriod[] = [];

  constructor(partial: Partial<TeacherTimetableDto>) {
    Object.assign(this, partial);
  }
}




