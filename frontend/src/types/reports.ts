export enum ReportPeriodType {
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export interface AcademicEntry {
  assessmentId: string;
  subjectId: string;
  subjectName: string;
  assessmentTitle: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  letterGrade?: string;
  rank?: number;
  percentile?: number;
}

export interface AcademicSection {
  entries: AcademicEntry[];
}

export interface AttendanceSection {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  percentage: number;
}

export interface BehavioralAttributeAverage {
  attributeName: string;
  average: number;
  count: number;
}

export interface BehavioralPeriod {
  period: string;
  attributes: BehavioralAttributeAverage[];
}

export interface BehavioralSection {
  periods: BehavioralPeriod[];
}

export interface AssignmentStatistics {
  totalAssignments: number;
  viewedAssignments: number;
  notViewedAssignments: number;
  submittedAssignments: number;
  inProgressAssignments: number;
  notStartedAssignments: number;
  viewingRate: number;
  submissionRate: number;
}

export interface AssignmentEngagement {
  assignmentId: string;
  assignmentTitle: string;
  subjectName: string;
  dueDate?: string;
  isViewed: boolean;
  viewedAt?: string;
  status: 'not_started' | 'in_progress' | 'submitted';
  submittedAt?: string;
  daysUntilDue?: number;
  engagementScore: number;
}

export interface StudentReport {
  studentId: string;
  studentName: string;
  academicYearId: string;
  academicYearName: string;
  academic?: AcademicSection;
  attendance?: AttendanceSection;
  behavioral?: BehavioralSection;
  assignmentStatistics?: AssignmentStatistics;
  assignmentEngagement?: AssignmentEngagement[];
}

export interface ClassReportStudent {
  studentId: string;
  studentName: string;
  presentDays: number;
  totalDays: number;
  attendancePercentage: number;
  averagePercentage?: number;
}

export interface ClassReport {
  classSectionId: string;
  className: string;
  sectionName: string;
  academicYearId: string;
  students: ClassReportStudent[];
}

export interface RankingEntry {
  studentId: string;
  studentName: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  rank?: number;
  percentile?: number;
}

export interface Rankings {
  classSectionId: string;
  subjectId: string;
  subjectName: string;
  entries: RankingEntry[];
}
