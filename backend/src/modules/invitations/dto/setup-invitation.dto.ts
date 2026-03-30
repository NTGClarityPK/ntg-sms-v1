import { IsString, Matches, MinLength } from 'class-validator';

export class SetupInvitationDto {
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must include at least one letter and one number',
  })
  password!: string;
}

