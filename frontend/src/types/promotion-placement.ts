export type PromotionOutcome =
  | 'promoted'
  | 'repeated'
  | 'graduated'
  | 'transferred_out'
  | 'withdrawn'
  | 'inactive';

export type PromotionStudent = {
  id: string;
  studentId: string;
  firstName?: string;
  lastName?: string;
  classId?: string;
  sectionId?: string;
  classSectionId?: string;
  decisionOutcome?: PromotionOutcome;
  targetClassId?: string;
  targetSectionId?: string;
};

export type SavePromotionDecisionsInput = {
  sourceAcademicYearId: string;
  decisions: Array<{
    studentId: string;
    outcome: PromotionOutcome;
    targetClassId?: string | null;
    targetSectionId?: string | null;
  }>;
};

export type YearCloseReadiness = {
  academicYearId: string;
  totalActiveStudents: number;
  decisionsCompleted: number;
  decisionsMissing: number;
  missingStudentIds: string[];
};

