export class TimingTemplateInfoDto {
  templateId!: string;
  templateName!: string;
  startTime!: string;
  endTime!: string;
  periodDurationMinutes!: number;
  slots!: Array<{
    name: string;
    startTime: string | null;
    endTime: string | null;
    sortOrder: number;
  }>;
}

