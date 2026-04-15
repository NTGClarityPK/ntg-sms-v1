import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsString()
  @MaxLength(320)
  @IsEmail()
  email!: string;

  /**
   * When true, allow sending to the provided login email if no associated invitation recipient email is found.
   * This enables a confirmation step in the UI.
   */
  @IsOptional()
  @IsBoolean()
  confirmSendToProvided?: boolean;
}
