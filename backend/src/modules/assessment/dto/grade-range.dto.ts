export class GradeRangeDto {
  id!: string;
  letter!: string;
  minPercentage!: number;
  maxPercentage!: number;
  sortOrder!: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<GradeRangeDto>) {
    Object.assign(this, partial);
  }
}


