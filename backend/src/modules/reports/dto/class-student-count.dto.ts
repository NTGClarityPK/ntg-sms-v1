export class ClassStudentCountDto {
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  totalStudents!: number;
  maleCount!: number;
  femaleCount!: number;

  constructor(partial: Partial<ClassStudentCountDto>) {
    Object.assign(this, partial);
  }
}
