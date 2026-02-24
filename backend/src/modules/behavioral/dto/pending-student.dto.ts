export class PendingStudentDto {
  constructor(partial: Partial<PendingStudentDto>) {
    Object.assign(this, partial);
  }

  id!: string;
  studentId!: string;
  firstName!: string;
  lastName!: string;
  className?: string;
  sectionName?: string;
}
