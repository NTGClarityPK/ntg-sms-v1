export class ResultCardDto {
  id!: string;
  studentId!: string;
  classSectionId!: string;
  academicYearId!: string;
  branchId!: string;
  resultType!: string;
  generatedAt!: string;
  generatedBy?: string;
  resultData!: Record<string, unknown>;
  pdfUrl?: string;
  status!: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Optional comment from class teacher for detailed report card. */
  classTeacherComment?: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<ResultCardDto>) {
    Object.assign(this, partial);
  }
}
