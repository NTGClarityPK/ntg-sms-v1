export class RankingEntryDto {
  constructor(partial: Partial<RankingEntryDto>) {
    Object.assign(this, partial);
  }

  studentId!: string;
  studentName!: string;
  marksObtained!: number;
  totalMarks!: number;
  percentage!: number;
  /** 1-based rank, only for top 3; others get percentile. */
  rank?: number;
  /** e.g. 40 for "Top 40%". */
  percentile?: number;
}

export class RankingsDto {
  constructor(partial: Partial<RankingsDto>) {
    Object.assign(this, partial);
  }

  classSectionId!: string;
  subjectId!: string;
  subjectName!: string;
  entries!: RankingEntryDto[];
}
