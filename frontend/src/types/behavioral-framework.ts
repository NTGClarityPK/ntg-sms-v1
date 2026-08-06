export type BehavioralActiveSystem = 'star_based' | 'framework_based';

export interface RatingScaleLevel {
  code: string;
  label: string;
  order: number;
  color?: string;
}

export interface FrameworkCategory {
  id: string;
  categoryName: string;
  description?: string;
  sortOrder: number;
  indicators: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkPreset {
  id: string;
  presetName: string;
  presetCode?: string;
  description?: string;
  isGlobal: boolean;
  branchId?: string;
  defaultRatingScale: RatingScaleLevel[];
  commentsRequired: boolean;
  categories: FrameworkCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface BranchBehavioralConfig {
  id?: string;
  branchId: string;
  activeSystem: BehavioralActiveSystem;
  frameworkPresetId?: string;
  frameworkPreset?: FrameworkPreset;
  switchedAt?: string;
  switchedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateBranchBehavioralConfigInput {
  activeSystem: BehavioralActiveSystem;
  frameworkPresetId?: string;
}

export interface CreateBlankFrameworkPresetInput {
  presetName: string;
  description?: string;
  commentsRequired?: boolean;
  defaultRatingScale?: RatingScaleLevel[];
}

export interface UpdateFrameworkPresetInput {
  presetName?: string;
  description?: string;
  commentsRequired?: boolean;
  defaultRatingScale?: RatingScaleLevel[];
}

export interface CreateFrameworkCategoryInput {
  categoryName: string;
  description?: string;
  sortOrder?: number;
  indicators?: string[];
}

export interface UpdateFrameworkCategoryInput {
  categoryName?: string;
  description?: string;
  sortOrder?: number;
  indicators?: string[];
}

export interface FrameworkCategoryScore {
  id: string;
  categoryId: string;
  categoryName: string;
  ratingCode: string;
  teacherComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkRating {
  id: string;
  studentId: string;
  branchId: string;
  academicYearId: string;
  presetId: string;
  ratingPeriod: string;
  periodLabel: string;
  assessmentMonth: string;
  ratedBy: string;
  ratedAt: string;
  categoryScores: FrameworkCategoryScore[];
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkCategoryScoreInput {
  categoryId: string;
  ratingCode: string;
  teacherComment?: string;
}

export interface CreateFrameworkRatingInput {
  studentId: string;
  assessmentMonth: string;
  categoryScores: FrameworkCategoryScoreInput[];
}

export interface UpdateFrameworkRatingInput {
  categoryScores: FrameworkCategoryScoreInput[];
}

export interface ClassFrameworkReportStudent {
  studentId: string;
  schoolStudentId: string;
  firstName: string;
  lastName: string;
  rating?: FrameworkRating;
}

export interface ClassFrameworkReport {
  classSectionId: string;
  assessmentMonth: string;
  activeSystem: BehavioralActiveSystem;
  students: ClassFrameworkReportStudent[];
}

export interface StarHistoryScore {
  id: string;
  attributeName: string;
  score: number;
}

export interface StarHistoryEntry {
  id: string;
  assessedBy: string;
  scores: StarHistoryScore[];
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkHistoryEntry {
  id: string;
  ratedBy: string;
  presetId: string;
  periodLabel: string;
  categoryScores: FrameworkCategoryScore[];
  createdAt: string;
  updatedAt: string;
}

export interface CombinedHistoryEntry {
  period: string;
  systemType: BehavioralActiveSystem;
  payload: StarHistoryEntry | FrameworkHistoryEntry;
}

export interface CombinedBehavioralHistory {
  entries: CombinedHistoryEntry[];
}

export function isFrameworkHistoryPayload(
  entry: CombinedHistoryEntry,
): entry is CombinedHistoryEntry & { payload: FrameworkHistoryEntry } {
  return entry.systemType === 'framework_based';
}

export function isStarHistoryPayload(
  entry: CombinedHistoryEntry,
): entry is CombinedHistoryEntry & { payload: StarHistoryEntry } {
  return entry.systemType === 'star_based';
}
