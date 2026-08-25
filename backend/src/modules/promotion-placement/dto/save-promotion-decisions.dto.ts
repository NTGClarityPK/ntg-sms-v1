import { IsArray, IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { PromotionOutcome } from './promotion-outcome.enum';

class PromotionDecisionInput {
  @IsUUID()
  studentId!: string;

  @IsIn(['promoted', 'repeated', 'graduated', 'transferred_out', 'withdrawn', 'inactive'])
  outcome!: PromotionOutcome;

  @IsOptional()
  @IsUUID()
  targetClassId?: string | null;

  @IsOptional()
  @IsUUID()
  targetSectionId?: string | null;
}

export class SavePromotionDecisionsDto {
  @IsUUID()
  sourceAcademicYearId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionDecisionInput)
  decisions!: PromotionDecisionInput[];

  /** Present when the save was scoped to a specific class-section (required for Graduate-all). */
  @IsOptional()
  @IsUUID()
  classSectionId?: string | null;
}

