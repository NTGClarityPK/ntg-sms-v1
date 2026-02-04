export interface SubjectTemplate {
  id: string;
  name: string;
  description?: string;
  branchId: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  subjectIds: string[];
  assignedClassIds: string[];
  assignedLevelIds: string[];
}

export interface CreateSubjectTemplateInput {
  name: string;
  description?: string;
  subjectIds?: string[];
}

export interface UpdateSubjectTemplateInput {
  name?: string;
  description?: string;
  subjectIds?: string[];
}

