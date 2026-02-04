export class SubjectTemplateDto {
  id!: string;
  name!: string;
  description?: string;
  branchId!: string;
  tenantId?: string;
  createdAt!: string;
  updatedAt!: string;
  subjectIds: string[] = [];
  assignedClassIds: string[] = [];
  assignedLevelIds: string[] = [];

  constructor(partial: Partial<SubjectTemplateDto>) {
    Object.assign(this, partial);
  }
}

