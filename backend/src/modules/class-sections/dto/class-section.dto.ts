export class ClassSectionDto {
  id!: string;
  classId!: string;
  sectionId!: string;
  branchId!: string;
  academicYearId!: string;
  capacity!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
  className?: string;
  classDisplayName?: string;
  sectionName?: string;
  studentCount?: number;
  classTeacherId?: string;
  classTeacherName?: string;

  constructor(partial: Partial<ClassSectionDto>) {
    Object.assign(this, partial);
  }
}

