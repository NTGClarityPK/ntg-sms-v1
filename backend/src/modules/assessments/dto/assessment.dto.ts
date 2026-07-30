export class AssessmentDto {
  id!: string;
  title!: string;
  description?: string;
  assessmentTypeId!: string;
  subjectId!: string;
  subjectName?: string;
  classSectionId!: string;
  /** Display label like "Class - Section" for list UIs. */
  classSectionName?: string;
  createdBy!: string;
  /** Display name of the user who posted/created this assessment (typically a teacher). */
  teacherName?: string;
  totalMarks!: number;
  dueDate?: string;
  publishDate?: string;
  isPublished!: boolean;
  allowLateSubmission!: boolean;
  /** Optional exam venue; used for term examination assessments. */
  roomNumber?: string;
  /** Term examinations: duration in minutes (end = `dueDate` start + duration). */
  examinationDurationMinutes?: number;
  /** `manual` or `google_classroom`. */
  gradingSource?: string;
  googleCourseworkId?: string;
  googleCourseId?: string;
  googleLastSyncedAt?: string;
  hasRubric?: boolean;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AssessmentDto>) {
    Object.assign(this, partial);
  }
}



