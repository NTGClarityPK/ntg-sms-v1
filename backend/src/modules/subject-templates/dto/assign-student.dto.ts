import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignStudentToTemplateDto {
  @IsUUID('4')
  @IsNotEmpty()
  subjectTemplateId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  academicYearId!: string;
}




