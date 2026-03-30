import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class ResendInvitationDto {
  @IsOptional()
  @IsUUID()
  invitationId?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}

