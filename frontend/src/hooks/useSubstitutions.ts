import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiClient, getEffectiveApiBaseURL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type {
  AssignSubstitutionsInput,
  AssignSubstitutionsResult,
  Substitution,
  SubstitutionLoadStat,
  SubstitutionOverlay,
  SuggestSubstitutionsInput,
  SuggestSubstitutionsResult,
} from '@/types/substitutions';

interface QuerySubstitutionsParams {
  page?: number;
  limit?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

function buildQuery(params?: QuerySubstitutionsParams): string {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.date) queryParams.append('date', params.date);
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);
  if (params?.status) queryParams.append('status', params.status);
  return queryParams.toString();
}

export function useSubstitutions(params?: QuerySubstitutionsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['substitutions', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const qs = buildQuery(params);
      return apiClient.get<Substitution[]>(`/api/v1/substitutions?${qs}`);
    },
    enabled: !!branchId,
  });
}

export function useSubstitutionHistory(params?: QuerySubstitutionsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['substitutions', 'history', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const qs = buildQuery(params);
      return apiClient.get<Substitution[]>(`/api/v1/substitutions/history?${qs}`);
    },
    enabled: !!branchId,
  });
}

export function useMySubstitutions(params?: QuerySubstitutionsParams) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['substitutions', 'me', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const qs = buildQuery(params);
      return apiClient.get<Substitution[]>(`/api/v1/substitutions/me?${qs}`);
    },
    enabled: !!branchId,
  });
}

export function useSubstitutionOverlays(startDate: string | null, endDate: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['substitutions', 'overlays', branchId, startDate, endDate],
    queryFn: async () => {
      if (!branchId || !startDate || !endDate) return null;
      const qs = new URLSearchParams({ startDate, endDate }).toString();
      const response = await apiClient.get<SubstitutionOverlay[]>(
        `/api/v1/substitutions/overlays?${qs}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!startDate && !!endDate,
  });
}

export function useSubstitutionLoadStats(startDate: string | null, endDate: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['substitutions', 'load-stats', branchId, startDate, endDate],
    queryFn: async () => {
      if (!branchId || !startDate || !endDate) return null;
      const qs = new URLSearchParams({ startDate, endDate }).toString();
      const response = await apiClient.get<SubstitutionLoadStat[]>(
        `/api/v1/substitutions/load-stats?${qs}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!startDate && !!endDate,
  });
}

export function useSuggestSubstitutions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const colors = useThemeColors();

  return useMutation({
    mutationFn: async (input: SuggestSubstitutionsInput) => {
      const response = await apiClient.post<SuggestSubstitutionsResult>(
        '/api/v1/substitutions/suggest',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['substitutions', branchId] });
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: colors.error,
      });
    },
  });
}

export function useAssignSubstitutions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const colors = useThemeColors();

  return useMutation({
    mutationFn: async (input: AssignSubstitutionsInput) => {
      const response = await apiClient.post<AssignSubstitutionsResult>(
        '/api/v1/substitutions/assign',
        input,
      );
      return response.data;
    },
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['substitutions', branchId] });
        queryClient.invalidateQueries({ queryKey: ['substitutions', 'history', branchId] });
        queryClient.invalidateQueries({ queryKey: ['substitutions', 'me', branchId] });
        queryClient.invalidateQueries({ queryKey: ['substitutions', 'load-stats', branchId] });
        queryClient.invalidateQueries({ queryKey: ['substitutions', 'overlays', branchId] });
      }
      notifications.show({
        title: 'Success',
        message: 'Substitutions assigned and substitute notified',
        color: colors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: colors.error,
      });
    },
  });
}

export function useCancelSubstitution() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const colors = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<Substitution>(
        `/api/v1/substitutions/${id}/cancel`,
        {},
      );
      return response.data;
    },
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['substitutions', branchId] });
        queryClient.invalidateQueries({ queryKey: ['substitutions', 'history', branchId] });
        queryClient.invalidateQueries({ queryKey: ['substitutions', 'overlays', branchId] });
      }
      notifications.show({
        title: 'Success',
        message: 'Substitution removed — original teacher restored for that period',
        color: colors.success,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: colors.error,
      });
    },
  });
}

export async function exportSubstitutionHistoryCsv(params: QuerySubstitutionsParams): Promise<void> {
  const qs = buildQuery(params);
  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const base = getEffectiveApiBaseURL();
  const res = await fetch(`${base}/api/v1/substitutions/history/export?${qs}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(branchId ? { 'X-Branch-Id': branchId } : {}),
    },
  });
  if (!res.ok) {
    throw new Error('Export failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'substitution-history.csv';
  a.click();
  URL.revokeObjectURL(url);
}
