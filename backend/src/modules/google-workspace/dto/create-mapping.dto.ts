import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateGoogleCourseMappingDto {
  @IsUUID()
  classSectionId!: string;

  @IsUUID()
  subjectId!: string;

  @IsString()
  @MaxLength(200)
  googleCourseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  googleCourseName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  googleCourseSection?: string;
}
