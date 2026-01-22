export interface Student {
  id: string;
  userId: string;
  branchId: string;
  studentId: string;
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  fullName?: string;
  email?: string;
  className?: string;
  sectionName?: string;
}

export interface CreateStudentInput {
  email: string;
  password: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  studentId: string;
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive?: boolean;
}

export interface UpdateStudentInput {
  fullName?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  isActive?: boolean;
}

