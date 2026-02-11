import { AcademicSectionDto } from './academic-section.dto';
import { AttendanceSectionDto } from './attendance-section.dto';
import { BehavioralSectionDto } from './behavioral-section.dto';
import { AssignmentStatisticsDto } from './assignment-statistics.dto';
import { AssignmentEngagementDto } from './assignment-engagement.dto';

export class StudentReportDto {
  constructor(partial: Partial<StudentReportDto>) {
    Object.assign(this, partial);
  }

  studentId!: string;
  studentName!: string;
  academicYearId!: string;
  academicYearName!: string;
  academic?: AcademicSectionDto;
  attendance?: AttendanceSectionDto;
  behavioral?: BehavioralSectionDto;
  assignmentStatistics?: AssignmentStatisticsDto;
  assignmentEngagement?: AssignmentEngagementDto[];
}
