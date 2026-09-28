import { IsString, IsOptional, IsBoolean, IsUUID, Matches, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  gender?: 'male' | 'female';

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  classId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  bloodGroup?: string | null;

  @IsOptional()
  @IsString()
  medicalNotes?: string | null;

  @IsOptional()
  @IsString()
  admissionDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  subjectTemplateId?: string | null;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  /** Optional Google Classroom account email for grade sync matching. Pass empty string to clear. */
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

