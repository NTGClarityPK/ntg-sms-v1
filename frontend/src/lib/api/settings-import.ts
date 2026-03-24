import { apiClient } from '@/lib/api-client';

export interface SettingsImportSheetSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface SettingsImportValidationError {
  sheet: string;
  rowNumber: number;
  message: string;
}

export interface SettingsImportValidateResult {
  isValid: boolean;
  validationToken: string | null;
  errors: SettingsImportValidationError[];
  warnings: string[];
  summaryBySheet: Record<string, SettingsImportSheetSummary>;
}

export interface SettingsImportTemplateSheet {
  name: string;
  columns: string[];
  sample: Record<string, string>;
}

export interface SettingsImportTemplateDefinition {
  workbookName: string;
  sheets: SettingsImportTemplateSheet[];
}

export interface SettingsImportApplyResult {
  applied: boolean;
  created: Record<string, number>;
}

export const settingsImportApi = {
  async getTemplate(): Promise<SettingsImportTemplateDefinition> {
    const response = await apiClient.get<SettingsImportTemplateDefinition>(
      '/api/v1/settings-import/template',
    );
    return response.data;
  },

  async validate(file: File): Promise<SettingsImportValidateResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<SettingsImportValidateResult>(
      '/api/v1/settings-import/validate',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  async apply(validationToken: string): Promise<SettingsImportApplyResult> {
    const response = await apiClient.post<SettingsImportApplyResult>(
      '/api/v1/settings-import/apply',
      { validationToken },
    );
    return response.data;
  },
};

