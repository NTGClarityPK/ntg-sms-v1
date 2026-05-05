export class AssessmentTypeDto {
  id!: string;
  name!: string;
  nameAr?: string;
  /** When true, assessments of this type are shown on the examination schedule. */
  isTermExamination!: boolean;
  isActive!: boolean;
  sortOrder!: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AssessmentTypeDto>) {
    Object.assign(this, partial);
  }
}


