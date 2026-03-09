import { ResultSubjectDto } from './result-subject.dto';

export class StudentResultDto {
  studentId!: string;
  studentName!: string;
  studentStudentId?: string;
  subjects!: ResultSubjectDto[];
  overallPercentage?: number;
  overallLetterGrade?: string;

  constructor(partial: Partial<StudentResultDto>) {
    Object.assign(this, partial);
    if (this.subjects) {
      this.subjects = this.subjects.map((s) =>
        s instanceof ResultSubjectDto ? s : new ResultSubjectDto(s),
      );
    }
  }
}
