export class StudentDto {
  id!: string;
  userId?: string;
  branchId!: string;
  studentId!: string;
  classId?: string;
  sectionId?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  admissionDate?: string;
  academicYearId?: string;
  isActive!: boolean;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  /** Invitation / login lifecycle (independent of admin is_active for suspended accounts). */
  accountStatus!: 'active' | 'pending_verification' | 'link_expired';
  createdAt!: string;
  updatedAt!: string;
  /** Where the latest setup invitation was sent (if any). */
  invitationRecipientEmail?: string;
  /** When the latest setup invitation was sent (if any). */
  invitationSentAt?: string;
  // Joined data
  firstName?: string;
  lastName?: string;
  email?: string;
  className?: string;
  sectionName?: string;
  subjectTemplateId?: string;
  subjectTemplateName?: string;
  avatarUrl?: string;

  constructor(partial: Partial<StudentDto>) {
    Object.assign(this, partial);
  }
}

