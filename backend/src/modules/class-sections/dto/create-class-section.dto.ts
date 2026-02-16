import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateClassSectionDto {
  @IsUUID()
  classId!: string;

  @IsUUID()
  sectionId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

