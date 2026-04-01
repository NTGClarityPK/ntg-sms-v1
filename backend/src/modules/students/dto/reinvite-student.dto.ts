import { IsIn, IsString, Matches, ValidateIf } from 'class-validator';

export class ReinviteStudentDto {
  /** Student login username (without domain). */
  @IsString()
  @Matches(/^[a-z0-9]+$/i, { message: 'Username must be alphanumeric (no spaces or special characters)' })
  username!: string;

  @ValidateIf((o: ReinviteStudentDto) => o.invitationType === 'parent')
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
  invitationRecipientEmail!: string;

  @IsIn(['parent', 'student'])
  invitationType!: 'parent' | 'student';
}
