import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateClassSectionDto {
  @IsUUID()
  classId!: string;

  @IsUUID()
  sectionId!: string;

  @IsInt()
  @Min(1)
  capacity: number = 30;
}

