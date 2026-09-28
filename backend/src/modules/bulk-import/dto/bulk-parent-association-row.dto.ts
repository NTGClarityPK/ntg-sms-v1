import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

function cleanEmail(value: unknown): string | undefined {
  if (value == null) return undefined;
  const cleaned = String(value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return undefined;
  return cleaned.split(/[\r\n,; ]+/).filter(Boolean)[0] ?? cleaned;
}

function cleanOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const cleaned = String(value).trim();
  return cleaned || undefined;
}

function cleanRelationship(
  value: unknown,
): 'father' | 'mother' | 'guardian' | undefined {
  const cleaned = cleanOptionalString(value)?.toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === 'father' || cleaned === 'mother' || cleaned === 'guardian') {
    return cleaned;
  }
  return cleaned as 'father' | 'mother' | 'guardian';
}

export class BulkParentAssociationRowDto {
  @IsOptional()
  row_number?: number;

  @IsString()
  @Transform(({ value }) => {
    if (value == null) return value;
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '');
  })
  @Matches(/^[a-z0-9._]+$/, {
    message: 'Username may only contain letters, numbers, dots and underscores',
  })
  username!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  first_name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  last_name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  student_id?: string;

  @IsOptional()
  @Transform(({ value }) => cleanEmail(value))
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsEmail({}, { message: 'Invalid Guardian 1 email address' })
  guardian1_email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  guardian1_name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  guardian1_phone?: string;

  @IsOptional()
  @Transform(({ value }) => cleanRelationship(value))
  @ValidateIf((_, v) => v != null && v !== '')
  @IsIn(['father', 'mother', 'guardian'])
  guardian1_relationship?: 'father' | 'mother' | 'guardian';

  @IsOptional()
  @Transform(({ value }) => cleanEmail(value))
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsEmail({}, { message: 'Invalid Guardian 2 email address' })
  guardian2_email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  guardian2_name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => cleanOptionalString(value))
  guardian2_phone?: string;

  @IsOptional()
  @Transform(({ value }) => cleanRelationship(value))
  @ValidateIf((_, v) => v != null && v !== '')
  @IsIn(['father', 'mother', 'guardian'])
  guardian2_relationship?: 'father' | 'mother' | 'guardian';

  @IsOptional()
  @IsString()
  import_status?: string;
}
