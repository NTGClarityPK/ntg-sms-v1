import { IsString, MaxLength } from 'class-validator';

export class LinkAssessmentGoogleDto {
  @IsString()
  @MaxLength(200)
  googleCourseworkId!: string;
}
