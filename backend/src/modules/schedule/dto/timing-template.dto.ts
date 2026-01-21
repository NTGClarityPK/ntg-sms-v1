import { TimingSlotDto } from './timing-slot.dto';

export class TimingTemplateDto {
  id!: string;
  name!: string;
  startTime!: string; // HH:MM:SS
  endTime!: string; // HH:MM:SS
  periodDurationMinutes!: number;
  createdAt!: string;
  updatedAt!: string;
  assignedClassIds: string[] = [];
  slots: TimingSlotDto[] = [];

  constructor(partial: Partial<TimingTemplateDto>) {
    Object.assign(this, partial);
  }
}


