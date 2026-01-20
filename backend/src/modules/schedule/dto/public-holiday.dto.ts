export class PublicHolidayDto {
  id!: string;
  name!: string;
  nameAr?: string;
  startDate!: string; // YYYY-MM-DD
  endDate!: string; // YYYY-MM-DD
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<PublicHolidayDto>) {
    Object.assign(this, partial);
  }
}


