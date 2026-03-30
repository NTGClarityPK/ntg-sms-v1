export type StudentAccountStatus = 'active' | 'pending_verification' | 'link_expired';

export interface Student {
  id: string;
  userId?: string;
  branchId: string;
  studentId: string;
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive: boolean;
  accountStatus: StudentAccountStatus;
  createdAt: string;
  updatedAt: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  className?: string;
  sectionName?: string;
  subjectTemplateId?: string;
  subjectTemplateName?: string;
}

/** Display name for a student (first + second name). */
export function formatStudentName(s: { firstName?: string | null; lastName?: string | null }): string {
  const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  return name || 'N/A';
}

export interface CreateStudentInput {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  studentId?: string;
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive?: boolean;
  subjectTemplateId?: string;
}

export interface CreateStudentWithInvitationInput {
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive?: boolean;
  subjectTemplateId?: string;

  invitationRecipientEmail: string;
  invitationType: 'parent' | 'student';

  createParentAccount?: boolean;
  parentEmail?: string;
  parentName?: string;
  parentPhone?: string;
  parentRelationship?: 'father' | 'mother' | 'guardian';
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive?: boolean;
  subjectTemplateId?: string;
}

