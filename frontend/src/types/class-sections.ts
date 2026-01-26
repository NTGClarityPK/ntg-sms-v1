export interface ClassSection {
  id: string;
  classId: string;
  sectionId: string;
  branchId: string;
  academicYearId: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  className?: string;
  classDisplayName?: string;
  sectionName?: string;
  studentCount?: number;
  classTeacherId?: string;
  classTeacherName?: string;
}

export interface CreateClassSectionInput {
  classId: string;
  sectionId: string;
  capacity?: number;
}

export interface BulkCreateClassSectionInput {
  classSections: CreateClassSectionInput[];
}

export interface UpdateClassSectionInput {
  capacity?: number;
  isActive?: boolean;
}

export interface AssignClassTeacherInput {
  staffId: string | null;
}

export interface ClassSectionStudent {
  id: string;
  studentId: string;
  fullName: string;
}

