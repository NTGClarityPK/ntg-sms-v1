import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStudentDto {
  /** School login username (without domain). Letters, numbers, full stops and underscores only. */
  @IsString()
  @Matches(/^[a-z0-9._]+$/i, {
    message: 'Username may only contain letters, numbers, full stops and underscores',
  })
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

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
  @IsString()
  gender?: 'male' | 'female';

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  admissionDate?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  subjectTemplateId?: string;

  /** Optional Google Classroom account email for grade sync matching. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return value;
    const cleaned = String(value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim()
      .toLowerCase();
    return cleaned || null;
  })
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Invalid Google account email address',
  })
  googleAccountEmail?: string | null;
}

