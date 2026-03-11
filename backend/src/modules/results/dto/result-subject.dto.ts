export class ResultSubjectDto {
  subjectId!: string;
  subjectName!: string;
  marksObtained!: number;
  totalMarks!: number;
  percentage!: number;
  letterGrade?: string;

  constructor(partial: Partial<ResultSubjectDto>) {
    Object.assign(this, partial);
  }
}
