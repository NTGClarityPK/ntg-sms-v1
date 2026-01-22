export class StudentDto {
  id!: string;
  userId!: string;
  branchId!: string;
  studentId!: string;
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
  // Joined data
  fullName?: string;
  email?: string;
  className?: string;
  sectionName?: string;

  constructor(partial: Partial<StudentDto>) {
    Object.assign(this, partial);
  }
}

