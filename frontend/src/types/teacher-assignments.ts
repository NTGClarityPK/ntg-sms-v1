export interface TeacherAssignment {
  id: string;
  staffId: string;
  subjectId: string;
  classSectionId: string;
  academicYearId: string;
  branchId: string;
  createdAt: string;
  staffName?: string;
  subjectName?: string;
  className?: string;
  sectionName?: string;
  classSectionName?: string;
}

export interface CreateTeacherAssignmentInput {
  staffId: string;
  subjectId: string;
  classSectionId: string;
}

export interface UpdateTeacherAssignmentInput {
  staffId: string;
}

