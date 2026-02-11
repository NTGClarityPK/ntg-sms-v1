export class PendingStudentDto {
  constructor(partial: Partial<PendingStudentDto>) {
    Object.assign(this, partial);
  }

  id!: string;
  studentId!: string;
  fullName!: string;
  className?: string;
  sectionName?: string;
}
