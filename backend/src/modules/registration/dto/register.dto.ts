import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class RegisterDto {
  // School/Tenant Information
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  schoolName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'School code must be at least 2 characters' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @Matches(/^[A-Z0-9]([A-Z0-9-]*[A-Z0-9])?$/, {
    message: 'School code must be 2–32 characters (letters, numbers, hyphens)',
  })
  schoolCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'School domain must be a valid domain name (e.g. example.edu)',
  })
  schoolDomain?: string;

  // Branch Information
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchName!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchPhone?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  branchEmail?: string;

  // Academic Year (required at signup)
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  academicYearName!: string;

  @IsDateString()
  @IsNotEmpty()
  academicYearStartDate!: string;

  @IsDateString()
  @IsNotEmpty()
  academicYearEndDate!: string;

  // Admin User Information
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(STRONG_PASSWORD_PATTERN, {
    message:
      'Password must include uppercase, lowercase, a number, and a special character',
  })
  password!: string;

  /** Required for email signup after OTP verification on the admin step. */
  @IsString()
  @IsNotEmpty({ message: 'Please verify your email before creating the account' })
  emailVerificationToken!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;
}
