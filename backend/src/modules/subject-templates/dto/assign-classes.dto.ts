import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignClassesToTemplateDto {
  @IsArray()
  @IsNotEmpty()
  @IsUUID('4', { each: true })
  classIds!: string[];
}



