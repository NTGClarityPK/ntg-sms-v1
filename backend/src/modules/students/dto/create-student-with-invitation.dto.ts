import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStudentWithInvitationDto {
  /** School login username (without domain). Alphanumeric only. */
  @IsString()
  @Matches(/^[a-z0-9]+$/i, { message: 'Username must be alphanumeric (no spaces or special characters)' })
  username!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

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

  /**
   * Email to send the invitation to.
   * - For `invitationType='parent'`: must be a valid email.
   * - For `invitationType='student'`: may be a valid email OR a username (we will append tenant domain server-side).
   */
  @Transform(({ value }) => {
    if (value == null) return value;
    const cleaned = String(value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    if (!cleaned) return cleaned;
    // If multiple values/newlines were pasted, take the first token.
    return cleaned.split(/[\r\n,; ]+/).filter(Boolean)[0] ?? cleaned;
  })
  @IsString()
  @ValidateIf((o: CreateStudentWithInvitationDto) => o.invitationType === 'parent')
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid invitation recipient email address' })
  invitationRecipientEmail!: string;

  @IsIn(['parent', 'student'])
  invitationType!: 'parent' | 'student';

  // Scenario 3
  @IsOptional()
  @IsBoolean()
  createParentAccount?: boolean;

  @IsOptional()
  @ValidateIf((o: CreateStudentWithInvitationDto) => Boolean(o.createParentAccount))
  @Transform(({ value }) => {
    if (value == null) return value;
    const cleaned = String(value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    if (!cleaned) return cleaned;
    return cleaned.split(/[\r\n,; ]+/).filter(Boolean)[0] ?? cleaned;
  })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid parent email address' })
  parentEmail?: string;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsIn(['father', 'mother', 'guardian'])
  parentRelationship?: 'father' | 'mother' | 'guardian';
}

