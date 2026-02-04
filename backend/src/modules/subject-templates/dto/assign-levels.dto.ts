import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignLevelsToTemplateDto {
  @IsArray()
  @IsNotEmpty()
  @IsUUID('4', { each: true })
  levelIds!: string[];
}

