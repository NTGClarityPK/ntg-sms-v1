import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

export interface BulkImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: Array<{
    rowNumber: number;
    data: BulkStudentRowDto;
    errors: string[];
    isValid: boolean;
  }>;
}

export interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; message: string }>;
  created?: Array<{
    row: number;
    username: string;
    studentName: string;
    loginEmail: string;
    recipientEmail: string;
    invitationType: 'parent' | 'student';
    expiresAt: string;
    parentRecipientEmail?: string;
    parentExpiresAt?: string;
  }>;
}

export interface BulkStudentRowDto {
  row_number?: number;
  username: string;
  first_name: string;
  last_name: string;
  invitation_type: 'parent' | 'student';
  invitation_recipient_email?: string;
  create_parent_account: boolean;
  parent_relationship?: 'father' | 'mother' | 'guardian';
  phone?: string;
  date_of_birth?: string;
  gender: string;
  student_id?: string;
  class_name_or_id?: string;
  section_name_or_id?: string;
  subject_template_name_or_id?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
}

export interface TemplateColumnsResponse {
  columns: Array<{ key: string; label: string; example: string }>;
}

export interface SubjectTemplateHelpResponse {
  templates: Array<{
    id: string;
    name: string;
    classes: Array<{ id: string; name: string; displayName?: string | null }>;
  }>;
  meta?: { branchId?: string; branchName?: string | null; tenantName?: string | null };
}

export const bulkImportApi = {
  async previewStudents(file: File): Promise<BulkImportPreview> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<BulkImportPreview>(
      '/api/v1/bulk-import/students/preview',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return (res as ApiResponse<BulkImportPreview>).data ?? (res as unknown as BulkImportPreview);
  },

  async validateStudents(rows: BulkStudentRowDto[]): Promise<BulkImportPreview> {
    const res = await apiClient.post<BulkImportPreview>(
      '/api/v1/bulk-import/students/validate',
      { rows },
    );
    return (res as ApiResponse<BulkImportPreview>).data ?? (res as unknown as BulkImportPreview);
  },

  async importStudents(
    rows: BulkStudentRowDto[],
    academicYearId: string,
  ): Promise<BulkImportResult> {
    const res = await apiClient.post<BulkImportResult>(
      '/api/v1/bulk-import/students/import',
      { rows, academicYearId },
    );
    return (res as ApiResponse<BulkImportResult>).data ?? (res as unknown as BulkImportResult);
  },

  async getTemplate(): Promise<TemplateColumnsResponse> {
    const res = await apiClient.post<TemplateColumnsResponse>(
      '/api/v1/bulk-import/students/template',
    );
    const data = (res as ApiResponse<TemplateColumnsResponse>).data;
    if (data) return data;
    return res as unknown as TemplateColumnsResponse;
  },

  async getSubjectTemplateHelp(): Promise<SubjectTemplateHelpResponse> {
    const res = await apiClient.post<SubjectTemplateHelpResponse>(
      '/api/v1/bulk-import/students/subject-template-help',
    );
    const data = (res as ApiResponse<SubjectTemplateHelpResponse>).data;
    if (data) return data;
    return res as unknown as SubjectTemplateHelpResponse;
  },
};
