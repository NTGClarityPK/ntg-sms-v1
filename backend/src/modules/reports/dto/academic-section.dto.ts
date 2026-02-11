export class AcademicEntryDto {
  constructor(partial: Partial<AcademicEntryDto>) {
    Object.assign(this, partial);
  }

  assessmentId!: string;
  subjectId!: string;
  subjectName!: string;
  assessmentTitle!: string;
  marksObtained!: number;
  totalMarks!: number;
  percentage!: number;
  letterGrade?: string;
  rank?: number;
  percentile?: number; // e.g. 40 for "Top 40%"
}

export class AcademicSectionDto {
  constructor(partial: Partial<AcademicSectionDto>) {
    Object.assign(this, partial);
  }

  entries!: AcademicEntryDto[];
}
