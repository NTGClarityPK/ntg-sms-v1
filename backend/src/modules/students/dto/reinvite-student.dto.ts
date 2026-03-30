import { IsEmail, IsIn, IsString } from 'class-validator';

export class ReinviteStudentDto {
  /** Student login email (Supabase Auth identifier). */
  @IsEmail()
  email!: string;

  @IsEmail()
  invitationRecipientEmail!: string;

  @IsIn(['parent', 'student'])
  invitationType!: 'parent' | 'student';
}
