export class TeacherAssignmentDto {
  id!: string;
  staffId!: string;
  subjectId!: string;
  classSectionId!: string;
  academicYearId!: string;
  branchId!: string;
  createdAt!: string;
  staffName?: string;
  subjectName?: string;
  className?: string;
  sectionName?: string;
  classSectionName?: string;

  constructor(partial: Partial<TeacherAssignmentDto>) {
    Object.assign(this, partial);
  }
}

