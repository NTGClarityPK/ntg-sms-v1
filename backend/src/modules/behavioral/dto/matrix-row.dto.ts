/** One row in the matrix: a student and their scores (or empty) for the month. */
export class BehavioralMatrixRowDto {
  constructor(partial: Partial<BehavioralMatrixRowDto>) {
    Object.assign(this, partial);
  }

  studentId!: string;
  studentName!: string;
  assessmentId?: string;
  /** Map attribute name -> score (1-5). Empty if not assessed. */
  scores!: Record<string, number>;
}
