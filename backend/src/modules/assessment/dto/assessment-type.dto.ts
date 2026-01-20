export class AssessmentTypeDto {
  id!: string;
  name!: string;
  nameAr?: string;
  isActive!: boolean;
  sortOrder!: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AssessmentTypeDto>) {
    Object.assign(this, partial);
  }
}


