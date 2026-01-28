import { AttendanceDto } from './attendance.dto';
import { AttendanceSummaryDto } from './attendance-summary.dto';

export class AttendanceReportDto {
  startDate!: string;
  endDate!: string;
  classSectionId?: string;
  className?: string;
  sectionName?: string;
  summary!: AttendanceSummaryDto;
  records!: AttendanceDto[];

  constructor(partial: Partial<AttendanceReportDto>) {
    Object.assign(this, partial);
  }
}



