export interface PendingStudent {
  id: string;
  studentId: string;
  fullName: string;
  className?: string;
  sectionName?: string;
}

export interface BehavioralScore {
  id: string;
  attributeName: string;
  score: number;
  createdAt: string;
}

export interface BehavioralAssessment {
  id: string;
  studentId: string;
  assessedBy: string;
  assessmentMonth: string;
  branchId: string;
  academicYearId: string;
  scores: BehavioralScore[];
  createdAt: string;
  updatedAt: string;
}

export interface BehavioralMatrixRow {
  studentId: string;
  studentName: string;
  assessmentId?: string;
  scores: Record<string, number>;
}

export interface BehavioralMatrixResponse {
  attributes: string[];
  rows: BehavioralMatrixRow[];
  assessmentMonth: string;
  classSectionId: string;
  className?: string;
  sectionName?: string;
}

export interface CreateBehavioralAssessmentInput {
  studentId: string;
  assessmentMonth: string;
  scores: Array<{ attributeName: string; score: number }>;
}

export interface UpdateBehavioralAssessmentInput {
  scores?: Array<{ attributeName: string; score: number }>;
}
