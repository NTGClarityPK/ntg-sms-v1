import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  settingsImportApi,
  type SettingsImportApplyResult,
  type SettingsImportTemplateDefinition,
  type SettingsImportValidateResult,
} from '@/lib/api/settings-import';

export function useSettingsImportTemplate() {
  return useQuery({
    queryKey: ['settings-import-template'],
    queryFn: (): Promise<SettingsImportTemplateDefinition> =>
      settingsImportApi.getTemplate(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSettingsImportValidate() {
  return useMutation({
    mutationFn: (file: File): Promise<SettingsImportValidateResult> =>
      settingsImportApi.validate(file),
  });
}

export function useSettingsImportApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (validationToken: string): Promise<SettingsImportApplyResult> =>
      settingsImportApi.apply(validationToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settingsStatus'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['levels'] });
      queryClient.invalidateQueries({ queryKey: ['academicYears'] });
      queryClient.invalidateQueries({ queryKey: ['assessmentTypes'] });
    },
  });
}

