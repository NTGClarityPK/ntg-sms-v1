import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReplicateAcrossSectionsDto {
  @IsUUID()
  sourceClassSectionId!: string; // Source class section to copy from

  @IsArray()
  @IsUUID('4', { each: true })
  targetClassSectionIds!: string[]; // Target class sections to copy to

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  subjectTemplateId?: string; // Only replicate slots for this template
}
