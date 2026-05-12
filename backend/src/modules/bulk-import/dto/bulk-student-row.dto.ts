import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  ValidateIf,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export class BulkStudentRowDto {
  /** Set from file row index when importing so error messages match the sheet (optional on parse). */
  @IsOptional()
  @IsInt()
  row_number?: number;

  @Transform(({ value }) => {
    if (value == null) return value;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return raw;
    // Normalise to allowed local-part characters (letters, numbers, full stop, underscore).
    return raw.replace(/[^a-z0-9._]/g, '');
  })
  @IsString()
  @Matches(/^[a-z0-9._]+$/i, {
    message:
      'Username may only contain letters, numbers, full stops and underscores. Use the portal login username without the school domain.',
  })
  username!: string;

  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @Transform(({ value }) => {
    if (value == null || value === '') return 'student';
    const v = String(value).trim().toLowerCase();
    if (v === 'parent' || v === 'student') return v;
    return value;
  })
  @IsIn(['parent', 'student'])
  invitation_type!: 'parent' | 'student';

  /**
   * Email where the student setup invitation is sent.
   * For invitation_type parent, must be a valid email (validated below).
   * For student, optional — blank means send to the school login email (username@tenant domain).
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    const v = String(value).trim();
    if (!v) return undefined;
    const lower = v.toLowerCase();
    if (lower === 'optional' || lower === 'n/a' || lower === 'na' || lower === '-') {
      return undefined;
    }
    return v;
  })
  invitation_recipient_email?: string;

  @Transform(({ value }) => {
    if (value == null || value === '') return false;
    if (typeof value === 'boolean') return value;
    const v = String(value).trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === '1' || v === 'y';
  })
  @IsBoolean()
  create_parent_account: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    const v = String(value).trim().toLowerCase();
    if (v === 'father' || v === 'mother' || v === 'guardian') return v;
    return value;
  })
  @IsIn(['father', 'mother', 'guardian'])
  parent_relationship?: 'father' | 'mother' | 'guardian';

  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === '' ? undefined : String(value),
  )
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    const v = String(value).trim();
    if (!v) return undefined;
    const lower = v.toLowerCase();
    if (lower === 'yyyy-mm-dd' || lower === 'optional' || lower === 'n/a' || lower === 'na' || lower === '-') {
      return undefined;
    }
    return v;
  })
  @ValidateIf((o) => o.date_of_birth != null && o.date_of_birth !== '')
  @IsDateString()
  date_of_birth?: string;

  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    const v = String(value).trim().toLowerCase();
    if (v === 'm' || v === 'male' || v === 'boy') return Gender.MALE;
    if (v === 'f' || v === 'female' || v === 'girl') return Gender.FEMALE;
    return value;
  })
  @IsEnum(Gender)
  gender!: Gender;

  @IsOptional()
  @IsString()
  student_id?: string;

  /** Class name or UUID (from Settings). Optional; validated against branch. */
  @IsOptional()
  @IsString()
  class_name_or_id?: string;

  /** Section name or UUID (from Settings). Optional; validated against branch. */
  @IsOptional()
  @IsString()
  section_name_or_id?: string;

  /** Subject template name or UUID (from Settings). Optional; must be linked to class if provided. */
  @IsOptional()
  @IsString()
  subject_template_name_or_id?: string;

  @ValidateIf((o: BulkStudentRowDto) => Boolean(o.create_parent_account))
  @IsEmail()
  parent_email?: string;

  @IsOptional()
  @IsString()
  parent_name?: string;

  @IsOptional()
  @IsString()
  parent_phone?: string;
}
