import { IsEmail, IsString, MaxLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsString()
  @MaxLength(320)
  @IsEmail()
  email!: string;
}
