import { IsArray, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AssignGradeTemplateDto {
  @IsArray()
  @IsUUID('4', { each: true })
  classIds!: string[];

  @IsUUID()
  gradeTemplateId!: string;

  @IsString()
  @IsNotEmpty()
  minimumPassingGrade!: string;
}


