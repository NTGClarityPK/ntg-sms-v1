/**
 * Frontend type definitions for assessments and grades
 */

export interface Assessment {
  id: string;
  title: string;
  description?: string;
  assessmentTypeId: string;
  subjectId: string;
  subjectName?: string;
  classSectionId: string;
  classSectionName?: string;
  createdBy: string;
  teacherName?: string;
  totalMarks: number;
  dueDate?: string;
  publishDate?: string;
  isPublished: boolean;
  allowLateSubmission: boolean;
  roomNumber?: string;
  /** Term examinations: minutes; end instant = dueDate + duration. */
  examinationDurationMinutes?: number;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
  attachments?: AssessmentAttachment[];
}

export interface AssessmentAttachment {
  id: string;
  assessmentId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType?: string;
  createdAt: string;
}

export interface CreateAssessmentInput {
  title: string;
  description?: string;
  assessmentTypeId: string;
  subjectId: string;
  // Option 1: Single class-section (existing, backward compatible)
  classSectionId?: string;
  // Option 2: Class-level with subject template (for all sections)
  classId?: string;
  subjectTemplateId?: string;
  // Option 3: Class-level with specific sections
  classSectionIds?: string[];
  totalMarks: number;
  dueDate?: string;
  roomNumber?: string;
  examinationDurationMinutes?: number;
  publishDate?: string;
  isPublished?: boolean;
  allowLateSubmission?: boolean;
  /** When set, draft materials (already compressed) are committed to the first created assessment. Total must be ≤10MB. */
  draftId?: string;
}

export interface StagedDraftFile {
  draftFileId: string;
  fileName: string;
  fileSizeBytes: number;
  fileUrl: string;
  mimeType: string;
}

export interface UpdateAssessmentInput {
  title?: string;
  description?: string;
  assessmentTypeId?: string;
  subjectId?: string;
  classSectionId?: string;
  totalMarks?: number;
  dueDate?: string;
  roomNumber?: string;
  examinationDurationMinutes?: number;
  publishDate?: string;
  isPublished?: boolean;
  allowLateSubmission?: boolean;
}

export interface QueryAssessmentsInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  classSectionId?: string;
  subjectId?: string;
  assessmentTypeId?: string;
  /** Profile UUID of the teacher who posted the assessment (`created_by`). */
  teacherUserId?: string;
  /** Backend expects status: 'all' | 'published' | 'unpublished' */
  status?: 'all' | 'published' | 'unpublished';
  startDate?: string;
  endDate?: string;
}

/** Query for `GET /api/v1/assessments/examination-schedule` and related PDF export. */
export interface QueryExaminationScheduleInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  academicYearId?: string;
  classSectionId?: string;
  subjectId?: string;
  startDate?: string;
  endDate?: string;
}

export interface StudentGrade {
  id: string;
  studentId: string;
  assessmentId: string;
  marksObtained: number;
  isAbsent: boolean;
  isExcused: boolean;
  remarks?: string;
  submittedAt?: string;
  gradedBy: string;
  gradedAt: string;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentGradeInput {
  studentId: string;
  assessmentId: string;
  marksObtained: number;
  isAbsent?: boolean;
  isExcused?: boolean;
  remarks?: string;
  submittedAt?: string;
}

export interface BulkCreateGradesInput {
  assessmentId: string;
  grades: CreateStudentGradeInput[];
}

export interface UpdateStudentGradeInput {
  marksObtained?: number;
  isAbsent?: boolean;
  isExcused?: boolean;
  remarks?: string;
  submittedAt?: string;
}

export interface QueryGradesInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  assessmentId?: string;
  studentId?: string;
  classSectionId?: string;
  subjectId?: string;
  isAbsent?: boolean;
  isExcused?: boolean;
}

export interface AssessmentStatistics {
  assessmentId: string;
  assessmentTitle: string;
  totalStudents: number;
  gradedCount: number;
  ungradedCount: number;
  absentCount: number;
  excusedCount: number;
  averageMarks?: number;
  highestMarks?: number;
  lowestMarks?: number;
  submissionRate: number;
  completionRate: number;
}

export interface ClassStatistics {
  classSectionId: string;
  classSectionName: string;
  totalStudents: number;
  totalAssessments: number;
  publishedAssessments: number;
  unpublishedAssessments: number;
  overallAverageMarks?: number;
  totalGradesEntered: number;
  totalGradesPending: number;
}

export interface SubjectStatistics {
  subjectId: string;
  subjectName: string;
  totalAssessments: number;
  publishedAssessments: number;
  averageMarksAcrossAssessments?: number;
  highestAverageMarks?: number;
  lowestAverageMarks?: number;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  totalAssessments: number;
  gradedAssessments: number;
  pendingAssessments: number;
  averageMarks?: number;
  totalMarksObtained?: number;
  totalPossibleMarks?: number;
  percentageScore?: number;
}

export interface BulkGradeError {
  studentId: string;
  error: string;
}


