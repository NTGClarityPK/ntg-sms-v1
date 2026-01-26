import { IsOptional, IsUUID } from 'class-validator';

export class AssignClassTeacherDto {
  @IsOptional()
  @IsUUID()
  staffId?: string | null;
}

