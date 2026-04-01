import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ResendInvitationForUserDto {
  @IsUUID()
  userId!: string;

  @IsIn(['student', 'parent', 'parent_account', 'staff'])
  invitationType!: 'student' | 'parent' | 'parent_account' | 'staff';

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}

