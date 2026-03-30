import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ResendInvitationForUserDto {
  @IsUUID()
  userId!: string;

  @IsIn(['student', 'parent'])
  invitationType!: 'student' | 'parent';

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}

