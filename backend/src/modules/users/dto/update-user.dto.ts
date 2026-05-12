import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsIn, IsEmail, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Email where password-setup invitations are sent (may differ from login email for staff).
   * Empty string clears the stored value.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((o) => o.invitationRecipientEmail !== null && o.invitationRecipientEmail !== undefined)
  @IsEmail()
  invitationRecipientEmail?: string | null;
}

