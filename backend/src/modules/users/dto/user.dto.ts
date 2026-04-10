export class UserDto {
  id!: string;
  email!: string;
  fullName!: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  isActive!: boolean;
  roles?: Array<{
    roleId: string;
    roleName: string;
    branchId: string;
  }>;
  createdAt!: string;
  updatedAt!: string;
  /** Where the latest setup invitation was sent (if any). */
  invitationRecipientEmail?: string;
  /** When the latest setup invitation was sent (if any). */
  invitationSentAt?: string;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}

