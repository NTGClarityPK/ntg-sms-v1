export class RubricCategoryDto {
  id!: string;
  categoryName!: string;
  categoryCode?: string;
  maxMarks!: number;
  sortOrder!: number;
  description?: string;
  googleCriterionId?: string;

  constructor(partial: Partial<RubricCategoryDto>) {
    Object.assign(this, partial);
  }
}

export class AssessmentRubricDto {
  id!: string;
  assessmentId!: string;
  branchId!: string;
  rubricType!: string;
  presetId?: string;
  totalMarks!: number;
  source!: string;
  googleRubricId?: string;
  categories!: RubricCategoryDto[];
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AssessmentRubricDto>) {
    Object.assign(this, partial);
  }
}

export class StudentRubricScoreDto {
  id!: string;
  studentGradeId!: string;
  rubricCategoryId!: string;
  categoryName?: string;
  categoryCode?: string;
  maxMarks?: number;
  marksObtained?: number;
  feedback?: string;
  source!: string;
  gradedAt?: string;

  constructor(partial: Partial<StudentRubricScoreDto>) {
    Object.assign(this, partial);
  }
}

export class AssessmentRubricWithScoresDto {
  rubric!: AssessmentRubricDto;
  scores!: StudentRubricScoreDto[];

  constructor(partial: Partial<AssessmentRubricWithScoresDto>) {
    Object.assign(this, partial);
  }
}
