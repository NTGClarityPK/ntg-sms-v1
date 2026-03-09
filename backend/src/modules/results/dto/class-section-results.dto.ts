import { StudentResultDto } from './student-result.dto';

export class ClassSectionResultsDto {
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  academicYearId!: string;
  resultType!: string;
  students!: StudentResultDto[];

  constructor(partial: Partial<ClassSectionResultsDto>) {
    Object.assign(this, partial);
    if (this.students) {
      this.students = this.students.map((s) =>
        s instanceof StudentResultDto ? s : new StudentResultDto(s),
      );
    }
  }
}
