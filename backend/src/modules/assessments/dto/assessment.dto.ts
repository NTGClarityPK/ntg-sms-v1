export class AssessmentDto {
  id!: string;
  title!: string;
  description?: string;
  assessmentTypeId!: string;
  subjectId!: string;
  classSectionId!: string;
  createdBy!: string;
  totalMarks!: number;
  dueDate?: string;
  publishDate?: string;
  isPublished!: boolean;
  allowLateSubmission!: boolean;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AssessmentDto>) {
    Object.assign(this, partial);
  }
}



