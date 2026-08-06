export class RatingScaleLevelResponseDto {
  code!: string;
  label!: string;
  order!: number;
  color?: string;

  constructor(partial: Partial<RatingScaleLevelResponseDto>) {
    Object.assign(this, partial);
  }
}

export class FrameworkCategoryDto {
  id!: string;
  categoryName!: string;
  description?: string;
  sortOrder!: number;
  indicators!: string[];
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<FrameworkCategoryDto>) {
    Object.assign(this, partial);
  }
}

export class FrameworkPresetDto {
  id!: string;
  presetName!: string;
  presetCode?: string;
  description?: string;
  isGlobal!: boolean;
  branchId?: string;
  defaultRatingScale!: RatingScaleLevelResponseDto[];
  commentsRequired!: boolean;
  categories!: FrameworkCategoryDto[];
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<FrameworkPresetDto>) {
    Object.assign(this, partial);
  }
}

export class BranchBehavioralConfigDto {
  id?: string;
  branchId!: string;
  activeSystem!: 'star_based' | 'framework_based';
  frameworkPresetId?: string;
  frameworkPreset?: FrameworkPresetDto;
  switchedAt?: string;
  switchedBy?: string;
  createdAt?: string;
  updatedAt?: string;

  constructor(partial: Partial<BranchBehavioralConfigDto>) {
    Object.assign(this, partial);
  }
}

export class FrameworkCategoryScoreDto {
  id!: string;
  categoryId!: string;
  categoryName!: string;
  ratingCode!: string;
  teacherComment?: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<FrameworkCategoryScoreDto>) {
    Object.assign(this, partial);
  }
}

export class FrameworkRatingDto {
  id!: string;
  studentId!: string;
  branchId!: string;
  academicYearId!: string;
  presetId!: string;
  ratingPeriod!: string;
  periodLabel!: string;
  assessmentMonth!: string;
  ratedBy!: string;
  ratedAt!: string;
  categoryScores!: FrameworkCategoryScoreDto[];
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<FrameworkRatingDto>) {
    Object.assign(this, partial);
  }
}

export class StarHistoryScoreDto {
  id!: string;
  attributeName!: string;
  score!: number;
}

export class StarHistoryEntryDto {
  id!: string;
  assessedBy!: string;
  scores!: StarHistoryScoreDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class FrameworkHistoryEntryDto {
  id!: string;
  ratedBy!: string;
  presetId!: string;
  periodLabel!: string;
  categoryScores!: FrameworkCategoryScoreDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class CombinedHistoryEntryDto {
  period!: string;
  systemType!: 'star_based' | 'framework_based';
  payload!: StarHistoryEntryDto | FrameworkHistoryEntryDto;

  constructor(partial: Partial<CombinedHistoryEntryDto>) {
    Object.assign(this, partial);
  }
}

export class CombinedBehavioralHistoryDto {
  entries!: CombinedHistoryEntryDto[];

  constructor(partial: Partial<CombinedBehavioralHistoryDto>) {
    Object.assign(this, partial);
  }
}

export class ClassFrameworkReportStudentDto {
  studentId!: string;
  schoolStudentId!: string;
  firstName!: string;
  lastName!: string;
  rating?: FrameworkRatingDto;
}

export class ClassFrameworkReportDto {
  classSectionId!: string;
  assessmentMonth!: string;
  activeSystem!: 'star_based' | 'framework_based';
  students!: ClassFrameworkReportStudentDto[];

  constructor(partial: Partial<ClassFrameworkReportDto>) {
    Object.assign(this, partial);
  }
}
