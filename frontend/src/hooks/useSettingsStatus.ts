import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import type { ApiResponse } from '@/types/api';

export interface SettingsStatus {
  academicYear: boolean;
  academic: boolean;
  schedule: boolean;
  assessment: boolean;
  communication: boolean;
  behavior: boolean;
  permissions: boolean;
  isInitialized: boolean;
}

const settingsStatusKeys = {
  status: ['settingsStatus'] as const,
  branchesWithSettings: ['settingsStatus', 'branchesWithSettings'] as const,
};

export interface BranchWithSettings {
  id: string;
  name: string;
  code: string | null;
}

export function useSettingsStatus() {
  const { user } = useAuth();
  const hasCurrentBranch = !!user?.currentBranch?.id;

  return useQuery({
    queryKey: settingsStatusKeys.status,
    queryFn: async () => {
      const res = await apiClient.get<SettingsStatus>('/api/v1/settings-status/status');
      return res;
    },
    enabled: hasCurrentBranch, // Only fetch if user has a current branch selected
  });
}

export function useBranchesWithSettings() {
  const { user } = useAuth();
  const hasCurrentBranch = !!user?.currentBranch?.id;

  return useQuery({
    queryKey: settingsStatusKeys.branchesWithSettings,
    queryFn: async () => {
      const res = await apiClient.get<BranchWithSettings[]>('/api/v1/settings-status/branches-with-settings');
      return res;
    },
    enabled: hasCurrentBranch,
  });
}

export function useCopySettingsFromBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceBranchId: string) => {
      const res = await apiClient.post<{ message: string }>('/api/v1/settings-status/copy-from-branch', {
        sourceBranchId,
      });
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: settingsStatusKeys.status });
      await qc.invalidateQueries({ queryKey: settingsStatusKeys.branchesWithSettings });
      // Invalidate all settings-related queries
      await qc.invalidateQueries({ queryKey: ['academicYears'] });
      await qc.invalidateQueries({ queryKey: ['subjects'] });
      await qc.invalidateQueries({ queryKey: ['classes'] });
      await qc.invalidateQueries({ queryKey: ['sections'] });
      await qc.invalidateQueries({ queryKey: ['levels'] });
      await qc.invalidateQueries({ queryKey: ['timingTemplates'] });
      await qc.invalidateQueries({ queryKey: ['assessmentTypes'] });
      await qc.invalidateQueries({ queryKey: ['gradeTemplates'] });
      await qc.invalidateQueries({ queryKey: ['systemSettings'] });
      await qc.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

