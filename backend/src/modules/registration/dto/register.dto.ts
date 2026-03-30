import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  // School/Tenant Information
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  schoolName!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  schoolCode?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'School domain must be a valid domain name (e.g. example.edu)',
  })
  schoolDomain!: string;

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
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;
}


