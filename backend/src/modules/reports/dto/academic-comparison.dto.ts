export class AcademicComparisonItemDto {
  constructor(partial: Partial<AcademicComparisonItemDto>) {
    Object.assign(this, partial);
  }
  id!: string;
  name!: string;
  averagePercentage!: number;
  studentCount!: number;
}

export class AcademicComparisonDto {
  constructor(partial: Partial<AcademicComparisonDto>) {
    Object.assign(this, partial);
  }
  type!: 'class' | 'subject';
  academicYearId!: string;
  items!: AcademicComparisonItemDto[];
}
