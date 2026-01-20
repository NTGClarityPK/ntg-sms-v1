export class AcademicYearDto {
  id!: string;
  name!: string;
  startDate!: string; // ISO date (YYYY-MM-DD)
  endDate!: string; // ISO date (YYYY-MM-DD)
  isActive!: boolean;
  isLocked!: boolean;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AcademicYearDto>) {
    Object.assign(this, partial);
  }
}


