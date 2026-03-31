import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ResendInvitationForUserDto {
  @IsUUID()
  userId!: string;

  @IsIn(['student', 'parent', 'parent_account'])
  invitationType!: 'student' | 'parent' | 'parent_account';

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}

