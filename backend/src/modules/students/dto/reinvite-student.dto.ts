import { IsIn, IsString, Matches, ValidateIf } from 'class-validator';

export class ReinviteStudentDto {
  /** Student login username (without domain). */
  @IsString()
  @Matches(/^[a-z0-9._]+$/i, {
    message: 'Username may only contain letters, numbers, full stops and underscores',
  })
  username!: string;

  @ValidateIf((o: ReinviteStudentDto) => o.invitationType === 'parent')
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
  invitationRecipientEmail!: string;

  @IsIn(['parent', 'student'])
  invitationType!: 'parent' | 'student';
}
