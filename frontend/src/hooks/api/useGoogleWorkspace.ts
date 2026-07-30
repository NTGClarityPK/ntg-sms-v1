/**
 * React Query hooks for Google Classroom / Workspace integration
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiClient } from '@/lib/api-client';
import type {
  ConnectGoogleResult,
  CreateGoogleCourseMappingInput,
  GoogleCourse,
  GoogleCourseMapping,
  GoogleCoursework,
  GoogleMappingSuggestion,
  GoogleWorkspaceSettings,
  PullGradesResult,
  QuerySyncHistoryParams,
  SyncAuditEntry,
  SyncStatus,
  TestConnectionResult,
} from '@/types/google-workspace';

const BASE = '/api/v1/google-workspace';

export function useGoogleWorkspaceSettings() {
  return useQuery({
    queryKey: ['google-workspace', 'settings'],
    queryFn: async () => {
      const response = await apiClient.get<GoogleWorkspaceSettings>(`${BASE}/settings`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateGoogleWorkspaceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (isFeatureEnabled: boolean) => {
      const response = await apiClient.put<GoogleWorkspaceSettings>(`${BASE}/settings`, {
        isFeatureEnabled,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-workspace'] });
      notifications.show({
        title: 'Success',
        message: 'Settings saved',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update settings',
        color: 'red',
      });
    },
  });
}

export function useConnectGoogleWorkspace() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ConnectGoogleResult>(`${BASE}/connect`);
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to start Google connection',
        color: 'red',
      });
    },
  });
}

export function useDisconnectGoogleWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<GoogleWorkspaceSettings>(`${BASE}/disconnect`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-workspace'] });
      notifications.show({
        title: 'Success',
        message: 'Google Workspace disconnected',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to disconnect',
        color: 'red',
      });
    },
  });
}

export function useTestGoogleConnection() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<TestConnectionResult>(`${BASE}/test-connection`);
      return response.data;
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Success',
        message: data?.ok
          ? `Connection OK (${data.courseCount} courses)`
          : 'Connection test failed',
        color: data?.ok ? 'green' : 'red',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Connection test failed',
        color: 'red',
      });
    },
  });
}

export function useGoogleCourses(enabled = true) {
  return useQuery({
    queryKey: ['google-workspace', 'courses'],
    queryFn: async () => {
      const response = await apiClient.get<GoogleCourse[]>(`${BASE}/courses`);
      return response.data;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useGoogleMappings() {
  return useQuery({
    queryKey: ['google-workspace', 'mappings'],
    queryFn: async () => {
      const response = await apiClient.get<GoogleCourseMapping[]>(`${BASE}/mappings`);
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateGoogleMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGoogleCourseMappingInput) => {
      const response = await apiClient.post<GoogleCourseMapping>(`${BASE}/mappings`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-workspace', 'mappings'] });
      notifications.show({
        title: 'Success',
        message: 'Course mapping created',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create mapping',
        color: 'red',
      });
    },
  });
}

export function useDeleteGoogleMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-workspace', 'mappings'] });
      notifications.show({
        title: 'Success',
        message: 'Mapping removed',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to remove mapping',
        color: 'red',
      });
    },
  });
}

export function useAutoSuggestGoogleMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<GoogleMappingSuggestion[]>(
        `${BASE}/mappings/auto-suggest`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-workspace', 'mappings'] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Auto-suggest failed',
        color: 'red',
      });
    },
  });
}

export function useGoogleCoursework(googleCourseId: string | undefined) {
  return useQuery({
    queryKey: ['google-workspace', 'coursework', googleCourseId],
    queryFn: async () => {
      const response = await apiClient.get<GoogleCoursework[]>(
        `${BASE}/coursework/${googleCourseId}`,
      );
      return response.data;
    },
    enabled: !!googleCourseId,
    staleTime: 1000 * 60,
  });
}

export function useLinkAssessmentGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assessmentId,
      googleCourseworkId,
    }: {
      assessmentId: string;
      googleCourseworkId: string;
    }) => {
      const response = await apiClient.post<SyncStatus>(
        `${BASE}/assessments/${assessmentId}/link`,
        { googleCourseworkId },
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['google-workspace', 'sync-status', variables.assessmentId],
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'assessment', variables.assessmentId] });
      notifications.show({
        title: 'Success',
        message: 'Assessment linked to Google Classroom',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to link assessment',
        color: 'red',
      });
    },
  });
}

export function useUnlinkAssessmentGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assessmentId: string) => {
      const response = await apiClient.delete<SyncStatus>(
        `${BASE}/assessments/${assessmentId}/link`,
      );
      return response.data;
    },
    onSuccess: (_data, assessmentId) => {
      queryClient.invalidateQueries({
        queryKey: ['google-workspace', 'sync-status', assessmentId],
      });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      notifications.show({
        title: 'Success',
        message: 'Assessment unlinked from Google Classroom',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to unlink assessment',
        color: 'red',
      });
    },
  });
}

export function usePullAssessmentGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assessmentId: string) => {
      const response = await apiClient.post<PullGradesResult>(
        `${BASE}/assessments/${assessmentId}/pull-grades`,
      );
      return response.data;
    },
    onSuccess: (_data, assessmentId) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['rubrics', 'assessment', assessmentId] });
      queryClient.invalidateQueries({
        queryKey: ['google-workspace', 'sync-status', assessmentId],
      });
      queryClient.invalidateQueries({ queryKey: ['google-workspace', 'sync-history'] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to pull grades',
        color: 'red',
      });
    },
  });
}

export function useAssessmentSyncStatus(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ['google-workspace', 'sync-status', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<SyncStatus>(
        `${BASE}/assessments/${assessmentId}/sync-status`,
      );
      return response.data;
    },
    enabled: !!assessmentId,
    staleTime: 1000 * 60,
  });
}

export function useGoogleSyncHistory(params: QuerySyncHistoryParams = {}) {
  return useQuery({
    queryKey: ['google-workspace', 'sync-history', params],
    queryFn: async () => {
      const response = await apiClient.get<SyncAuditEntry[]>(`${BASE}/sync-history`, {
        params,
      });
      return response;
    },
    staleTime: 1000 * 60,
  });
}
