import { IsUUID } from 'class-validator';

export class SelectChildDto {
  @IsUUID()
  studentId!: string;
}

