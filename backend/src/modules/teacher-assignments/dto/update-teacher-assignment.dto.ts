import { IsUUID } from 'class-validator';

export class UpdateTeacherAssignmentDto {
  @IsUUID()
  staffId!: string;
}

