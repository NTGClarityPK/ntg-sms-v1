export class BehavioralScoreDto {
  constructor(partial: Partial<BehavioralScoreDto>) {
    Object.assign(this, partial);
  }

  id!: string;
  attributeName!: string;
  score!: number;
  createdAt!: string;
}

export class BehavioralAssessmentDto {
  constructor(partial: Partial<BehavioralAssessmentDto>) {
    Object.assign(this, partial);
  }

  id!: string;
  studentId!: string;
  assessedBy!: string;
  assessmentMonth!: string;
  branchId!: string;
  academicYearId!: string;
  scores!: BehavioralScoreDto[];
  createdAt!: string;
  updatedAt!: string;
}
