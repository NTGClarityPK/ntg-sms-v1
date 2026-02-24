import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export class BulkStudentRowDto {
  @IsString()
  first_name!: string;

  @IsString()
  last_name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === '' ? undefined : String(value),
  )
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateIf((o) => o.date_of_birth != null && o.date_of_birth !== '')
  @IsDateString()
  date_of_birth?: string;

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

  @IsOptional()
  @IsString()
  parent_email?: string;

  @IsOptional()
  @IsString()
  parent_name?: string;

  @IsOptional()
  @IsString()
  parent_phone?: string;
}
