import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import type { CreateDataExportPayload, DataExportStatus } from '@/types/data-export';

const dataExportKeys = {
  status: ['dataExportStatus'] as const,
};

export function useDataExportStatus() {
  const { user } = useAuth();
  const hasCurrentBranch = !!user?.currentBranch?.id;

  return useQuery({
    queryKey: dataExportKeys.status,
    queryFn: async () => {
      const res = await apiClient.get<DataExportStatus>('/api/v1/data-export/status');
      return res.data;
    },
    enabled: hasCurrentBranch,
    staleTime: 60 * 1000,
  });
}

export function useCreateDataExport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDataExportPayload) => {
      const { blob, filename } = await apiClient.postBlobWithFilename(
        '/api/v1/data-export',
        payload,
        { timeout: 180_000 },
      );
      return { blob, filename };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dataExportKeys.status });
    },
  });
}
