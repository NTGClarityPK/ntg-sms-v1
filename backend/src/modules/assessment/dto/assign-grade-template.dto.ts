import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AssignGradeTemplateDto {
  @IsUUID()
  classId!: string;

  @IsUUID()
  gradeTemplateId!: string;

  @IsString()
  @IsNotEmpty()
  minimumPassingGrade!: string;
}


