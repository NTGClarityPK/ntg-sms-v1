import { BehavioralMatrixRowDto } from './matrix-row.dto';

export class BehavioralMatrixResponseDto {
  constructor(partial: Partial<BehavioralMatrixResponseDto>) {
    Object.assign(this, partial);
  }

  /** Ordered list of attribute names (columns). */
  attributes!: string[];
  /** Rows: one per student. */
  rows!: BehavioralMatrixRowDto[];
  assessmentMonth!: string;
  classSectionId!: string;
  className?: string;
  sectionName?: string;
}
