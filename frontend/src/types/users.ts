export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  isActive: boolean;
  accountStatus?: 'active' | 'pending_verification' | 'link_expired' | 'inactive';
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
  createdAt: string;
  updatedAt: string;
  /** Where the latest setup invitation was sent (if any). */
  invitationRecipientEmail?: string;
  /** When the latest setup invitation was sent (if any). */
  invitationSentAt?: string;
}

export interface CreateUserInput {
  email?: string;
  username?: string;
  invitationEmail?: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  roleIds: string[];
}

export interface UpdateUserInput {
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  isActive?: boolean;
  /** Stored on profile as invitation_recipient_email; used for password-setup invitations. */
  invitationRecipientEmail?: string | null;
}

export interface UpdateUserRolesInput {
  roleIds: string[];
}

