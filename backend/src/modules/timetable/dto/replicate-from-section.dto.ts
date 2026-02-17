import { IsOptional, IsUUID } from 'class-validator';

export class ReplicateFromSectionDto {
  @IsUUID()
  targetClassSectionId!: string; // Target class section to copy to (current section)

  @IsUUID()
  sourceClassSectionId!: string; // Source class section to copy from

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  subjectTemplateId?: string; // Only replicate slots for this template
}
