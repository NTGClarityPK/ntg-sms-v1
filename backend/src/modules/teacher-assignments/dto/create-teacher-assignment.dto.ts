import { IsUUID } from 'class-validator';

export class CreateTeacherAssignmentDto {
  @IsUUID()
  staffId!: string;

  @IsUUID()
  subjectId!: string;

  @IsUUID()
  classSectionId!: string;
}

