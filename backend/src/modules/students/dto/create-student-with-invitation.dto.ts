import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateStudentWithInvitationDto {
  @IsEmail()
  email!: string; // student's school login email

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

  @IsEmail()
  invitationRecipientEmail!: string;

  @IsIn(['parent', 'student'])
  invitationType!: 'parent' | 'student';

  // Scenario 3
  @IsOptional()
  @IsBoolean()
  createParentAccount?: boolean;

  @IsOptional()
  @IsEmail()
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

