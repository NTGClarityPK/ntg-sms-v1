import {
  IsString,
  IsOptional,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

function emptyToUndefined(value: unknown): unknown {
  if (value == null) return undefined;
  const v = String(value).trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === 'optional' || lower === 'n/a' || lower === 'na' || lower === '-') {
    return undefined;
  }
  return v;
}

export class BulkUserRowDto {
  /** Set from file row index when importing so error messages match the sheet. */
  @IsOptional()
  @IsInt()
  row_number?: number;

  @Transform(({ value }) => {
    if (value == null) return value;
    return String(value).trim();
  })
  @IsString()
  full_name!: string;

  /**
   * Role name(s) or display name(s), comma / semicolon separated.
   * Examples: "Teacher", "parent", "Class Teacher, Subject Teacher"
   */
  @Transform(({ value }) => {
    if (value == null) return value;
    return String(value).trim();
  })
  @IsString()
  roles!: string;

  /**
   * School email username (without domain) for staff users.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return undefined;
    return raw.replace(/[^a-z0-9._]/g, '');
  })
  @ValidateIf((o: BulkUserRowDto) => !!(o.username && String(o.username).trim()))
  @IsString()
  @Matches(/^[a-z0-9._]+$/i, {
    message:
      'Username may only contain letters, numbers, full stops and underscores. Use the portal login username without the school domain.',
  })
  username?: string;

  /**
   * Destination email for staff invitation (correspondence).
   */
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((o: BulkUserRowDto) => !!(o.invitation_email && String(o.invitation_email).trim()))
  @IsEmail()
  invitation_email?: string;

  /**
   * Login + invitation email for parent users.
   */
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((o: BulkUserRowDto) => !!(o.email && String(o.email).trim()))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const v = emptyToUndefined(value);
    if (v == null) return undefined;
    return String(v).trim().toLowerCase();
  })
  @ValidateIf((o: BulkUserRowDto) => !!(o.gender && String(o.gender).trim()))
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((o: BulkUserRowDto) => !!(o.date_of_birth && String(o.date_of_birth).trim()))
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  address?: string;
}
