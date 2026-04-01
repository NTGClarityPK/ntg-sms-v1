import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  /**
   * Primary display name for the user (staff or parent).
   */
  @IsString()
  fullName!: string;

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

  /**
   * Role IDs to assign in the current branch.
   * - Parent users: must only include parent roles (e.g. `parent`).
   * - Staff users: must NOT include parent roles.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  roleIds!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Login + invitation email for parent users (non-staff).
   * For parent accounts created via Users module, we send a parent-account invitation.
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * School email username (without domain) for staff users.
   * The full login email is `${username}@<tenant-domain>`.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+$/i, {
    message: 'Username must be alphanumeric (no spaces or special characters)',
  })
  username?: string;

  /**
   * Destination email address where the staff invitation link is sent.
   * This may be the same as, or different from, the school login email.
   */
  @IsOptional()
  @IsEmail()
  invitationEmail?: string;
}

