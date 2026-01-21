export class TimingSlotDto {
  id!: string;
  name!: string;
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  sortOrder!: number;
}

