import { TimetableSlotDto } from './timetable-slot.dto';

export class ClassTimetableDto {
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  slots: TimetableSlotDto[] = [];

  constructor(partial: Partial<ClassTimetableDto>) {
    Object.assign(this, partial);
  }
}




