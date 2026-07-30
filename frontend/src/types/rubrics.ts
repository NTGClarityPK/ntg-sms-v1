/**
 * Frontend types for assessment rubrics and presets
 */

export interface RubricPresetCategory {
  id: string;
  categoryName: string;
  categoryCode?: string;
  defaultMarks?: number;
  sortOrder: number;
  description?: string;
}

export interface RubricPreset {
  id: string;
  presetName: string;
  presetCode?: string;
  description?: string;
  isGlobal: boolean;
  isActive: boolean;
  branchId?: string;
  categories: RubricPresetCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface RubricCategory {
  id: string;
  categoryName: string;
  categoryCode?: string;
  maxMarks: number;
  sortOrder: number;
  description?: string;
  googleCriterionId?: string;
}

export interface AssessmentRubric {
  id: string;
  assessmentId: string;
  branchId: string;
  rubricType: string;
  presetId?: string;
  totalMarks: number;
  source: string;
  googleRubricId?: string;
  categories: RubricCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentRubricScore {
  id: string;
  studentGradeId: string;
  rubricCategoryId: string;
  categoryName?: string;
  categoryCode?: string;
  maxMarks?: number;
  marksObtained?: number;
  feedback?: string;
  source: string;
  gradedAt?: string;
}

export interface AssessmentRubricWithScores {
  rubric: AssessmentRubric;
  scores: StudentRubricScore[];
}

export interface CreateRubricCategoryInput {
  categoryName: string;
  categoryCode?: string;
  maxMarks: number;
  sortOrder?: number;
  description?: string;
}

export interface CreateAssessmentRubricInput {
  presetId?: string;
  rubricType?: string;
  categories: CreateRubricCategoryInput[];
}

export interface CreateRubricPresetCategoryInput {
  categoryName: string;
  categoryCode?: string;
  defaultMarks?: number;
  sortOrder?: number;
  description?: string;
}

export interface CreateRubricPresetInput {
  presetName: string;
  presetCode?: string;
  description?: string;
  categories: CreateRubricPresetCategoryInput[];
}

export interface UpdateRubricPresetInput {
  presetName?: string;
  description?: string;
  categories: CreateRubricPresetCategoryInput[];
}

export interface UpdateRubricCategoryInput {
  id?: string;
  categoryName: string;
  categoryCode?: string;
  maxMarks: number;
  sortOrder?: number;
  description?: string;
}

export interface UpdateAssessmentRubricInput {
  categories: UpdateRubricCategoryInput[];
}

export interface UpsertRubricScoreItem {
  categoryId: string;
  marksObtained: number;
  feedback?: string;
}

export interface UpsertStudentRubricScoresInput {
  scores: UpsertRubricScoreItem[];
}
