export class AssessmentDto {
  id!: string;
  title!: string;
  description?: string;
  assessmentTypeId!: string;
  subjectId!: string;
  subjectName?: string;
  classSectionId!: string;
  createdBy!: string;
  /** Display name of the user who posted/created this assessment (typically a teacher). */
  teacherName?: string;
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



