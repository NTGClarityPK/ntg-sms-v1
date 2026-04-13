export enum ReportPeriodType {
  ALL = 'all',
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
  assignmentStatistics?: AssignmentStatistics;
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

// Administrative attendance reports
export interface AttendanceReportStudentRow {
  studentId: string;
  studentName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  totalDays: number;
  percentage: number;
}

export interface AttendanceReportByClass {
  classSectionId: string;
  className: string;
  sectionName: string;
  startDate: string;
  endDate: string;
  students: AttendanceReportStudentRow[];
  classSummary: {
    averageAttendance: number;
    studentCount: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    totalExcused: number;
  };
}

export interface AttendanceSummaryClassItem {
  classSectionId: string;
  className: string;
  sectionName: string;
  averageAttendance: number;
  studentCount: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
}

export interface AttendanceSummaryBranch {
  startDate: string;
  endDate: string;
  byClass: AttendanceSummaryClassItem[];
  overall: {
    averageAttendance: number;
    totalStudents: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    totalExcused: number;
  };
}

export interface LowAttendanceStudent {
  studentId: string;
  studentName: string;
  classSectionId: string;
  className: string;
  sectionName: string;
  percentage: number;
  presentDays: number;
  absentDays: number;
  totalDays: number;
  belowThreshold: number;
}

export interface LowAttendanceReport {
  startDate: string;
  endDate: string;
  threshold: number;
  students: LowAttendanceStudent[];
}

// Administrative academic reports
export interface SubjectClassPerformance {
  classSectionId: string;
  className: string;
  sectionName: string;
  averagePercentage: number;
  studentCount: number;
  topPerformers: Array<{ studentId: string; studentName: string; percentage: number }>;
  struggling: Array<{ studentId: string; studentName: string; percentage: number }>;
}

export interface AcademicReportBySubject {
  subjectId: string;
  subjectName: string;
  academicYearId: string;
  byClass: SubjectClassPerformance[];
}

export interface AcademicComparisonItem {
  id: string;
  name: string;
  averagePercentage: number;
  studentCount: number;
}

export interface AcademicComparison {
  type: 'class' | 'subject';
  academicYearId: string;
  items: AcademicComparisonItem[];
}
