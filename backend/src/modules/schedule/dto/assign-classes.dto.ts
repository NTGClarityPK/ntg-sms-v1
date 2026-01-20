import { IsUUID } from 'class-validator';

export class AssignClassesDto {
  @IsUUID('4', { each: true })
  classIds!: string[];
}


