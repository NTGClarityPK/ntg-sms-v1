import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateLevelDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nameAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /**
   * Optional initial class assignments.
   */
  @IsOptional()
  @IsUUID('4', { each: true })
  classIds?: string[];
}


