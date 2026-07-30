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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  subjectTemplateId?: string;

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

