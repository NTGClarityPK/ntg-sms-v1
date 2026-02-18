import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type {
  UniformIssuance,
  IssuanceReportRow,
  CreateDirectIssuanceInput,
  QueryIssuanceReportParams,
} from '@/types/inventory';

export function useUniformIssuances(studentId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniform-issuances', 'student', studentId, branchId],
    queryFn: async () => {
      if (!studentId || !branchId) return [];
      const response = await apiClient.get<UniformIssuance[]>(
        `/api/v1/uniform-issuances/student/${studentId}`,
      );
      return response.data ?? [];
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useIssuanceReport(params: QueryIssuanceReportParams = {}) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['uniform-issuances', 'report', branchId, params],
    queryFn: async () => {
      if (!branchId) return [];
      const queryParams = new URLSearchParams();
      if (params.studentId) queryParams.append('studentId', params.studentId);
      if (params.uniformItemId)
        queryParams.append('uniformItemId', params.uniformItemId);
      if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
      if (params.dateTo) queryParams.append('dateTo', params.dateTo);

      const response = await apiClient.get<IssuanceReportRow[]>(
        `/api/v1/uniform-issuances/report?${queryParams.toString()}`,
      );
      return response.data ?? [];
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDirectIssuance() {
  const queryClient = useQueryClient();
  const { success: successColor, error: errorColor } = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateDirectIssuanceInput) => {
      const response = await apiClient.post<UniformIssuance>(
        '/api/v1/uniform-issuances',
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['uniform-issuances'] });
      queryClient.invalidateQueries({ queryKey: ['uniforms'] });
      queryClient.invalidateQueries({ queryKey: ['uniforms', 'low-stock'] });
      queryClient.invalidateQueries({
        queryKey: ['uniform-issuances', 'student', variables.studentId],
      });
      notifications.show({ title: 'Issuance recorded', message: '', color: successColor });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to record issuance',
        message: error.message,
        color: errorColor,
      });
    },
  });
}
