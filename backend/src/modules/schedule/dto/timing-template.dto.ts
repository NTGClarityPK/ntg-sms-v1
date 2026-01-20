export class TimingTemplateDto {
  id!: string;
  name!: string;
  startTime!: string; // HH:MM:SS
  endTime!: string; // HH:MM:SS
  assemblyStart?: string;
  assemblyEnd?: string;
  breakStart?: string;
  breakEnd?: string;
  periodDurationMinutes!: number;
  createdAt!: string;
  updatedAt!: string;
  assignedClassIds: string[] = [];

  constructor(partial: Partial<TimingTemplateDto>) {
    Object.assign(this, partial);
  }
}


