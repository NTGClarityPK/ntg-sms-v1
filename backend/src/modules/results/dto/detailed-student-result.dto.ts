import { StudentResultDto } from './student-result.dto';
import { AssessmentWiseEntryDto } from './assessment-wise-entry.dto';

export class DetailedStudentResultDto extends StudentResultDto {
  /** 1-based rank in class section by overall percentage. */
  classRank?: number;
  /** 1-based rank in school (branch) by overall percentage. */
  schoolRank?: number;
  /** Per-assessment marks breakdown. */
  assessmentWiseEntries!: AssessmentWiseEntryDto[];
  /** Short computer-generated paragraph (motivating or needs improvement). */
  generatedParagraph!: string;
  /** Optional comment from class teacher. */
  classTeacherComment?: string;

  constructor(partial: Partial<DetailedStudentResultDto>) {
    super(partial);
    Object.assign(this, partial);
    if (this.assessmentWiseEntries) {
      this.assessmentWiseEntries = this.assessmentWiseEntries.map((e) =>
        e instanceof AssessmentWiseEntryDto ? e : new AssessmentWiseEntryDto(e),
      );
    }
  }
}
