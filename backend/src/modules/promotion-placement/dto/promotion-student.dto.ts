import { PromotionOutcome } from './promotion-outcome.enum';

export class PromotionStudentDto {
  id!: string;
  studentId!: string;
  firstName?: string;
  lastName?: string;
  classId?: string;
  sectionId?: string;
  classSectionId?: string;

  decisionOutcome?: PromotionOutcome;
  targetClassId?: string;
  targetSectionId?: string;

  constructor(partial: Partial<PromotionStudentDto>) {
    Object.assign(this, partial);
  }
}

