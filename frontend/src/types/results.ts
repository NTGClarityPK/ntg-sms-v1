export type ResultType = 'interim' | 'mid_term' | 'final';

export interface ResultSubject {
  subjectId: string;
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  letterGrade?: string;
}

export interface StudentResult {
  studentId: string;
  studentName: string;
  studentStudentId?: string;
  subjects: ResultSubject[];
  overallPercentage?: number;
  overallLetterGrade?: string;
}

export interface ClassSectionResults {
  classSectionId: string;
  className: string;
  sectionName: string;
  academicYearId: string;
  resultType: string;
  students: StudentResult[];
}

export interface ResultCard {
  id: string;
  studentId: string;
  classSectionId: string;
  academicYearId: string;
  branchId: string;
  resultType: string;
  generatedAt: string;
  generatedBy?: string;
  resultData: Record<string, unknown>;
  pdfUrl?: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  classTeacherComment?: string;
  createdAt: string;
  updatedAt: string;
}
