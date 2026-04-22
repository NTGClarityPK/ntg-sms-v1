import { Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class CreateSubjectTemplateDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  classIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  levelIds?: string[];
}

