export class AssessmentWiseEntryDto {
  assessmentId!: string;
  assessmentTitle!: string;
  subjectName!: string;
  marksObtained!: number;
  totalMarks!: number;
  percentage!: number;

  constructor(partial: Partial<AssessmentWiseEntryDto>) {
    Object.assign(this, partial);
  }
}
