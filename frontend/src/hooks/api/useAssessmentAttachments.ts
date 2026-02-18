'use client';

/**
 * React Query hooks for assessment attachments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/hooks/useAuth';

export interface AssessmentAttachment {
  id: string;
  assessmentId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType?: string;
  createdAt: string;
}

export interface AssessmentUploadResult {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface DraftUploadResult {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  draftFileId: string;
  totalSizeBytes: number;
}

/**
 * Hook to get attachments for an assessment
 */
export function useAssessmentAttachments(assessmentId: string) {
  return useQuery({
    queryKey: ['assessment-attachments', assessmentId],
    queryFn: async (): Promise<AssessmentAttachment[]> => {
      const response = await apiClient.get<AssessmentAttachment[]>(
        `/api/v1/assessments/${assessmentId}/attachments`,
      );
      return response.data;
    },
    enabled: !!assessmentId,
    staleTime: 2 * 60 * 1000, // 2 minutes - attachments can change
  });
}

/**
 * Hook to create an attachment
 */
export function useCreateAssessmentAttachment(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      fileName: string;
      fileUrl: string;
      mimeType?: string;
      fileSizeBytes?: number;
    }): Promise<AssessmentAttachment> => {
      const response = await apiClient.post<AssessmentAttachment>(
        `/api/v1/assessments/${assessmentId}/attachments`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment-attachments', assessmentId] });
      notifications.show({
        title: 'Success',
        message: 'File uploaded successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to upload file',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to upload a file for an assessment (backend compresses images: 1920px max, 85% quality)
 */
export function useUploadAssessmentFile(assessmentId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (file: File): Promise<AssessmentUploadResult> => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post<{ data: AssessmentUploadResult }>(
        `/api/v1/assessments/${assessmentId}/upload`,
        formData,
      );
      const body = response.data as { data?: AssessmentUploadResult } & AssessmentUploadResult;
      const result = body.data ?? body;
      if (!result?.fileUrl) {
        throw new Error('Upload did not return file URL');
      }
      return result;
    },
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({ queryKey: ['branches', 'byId', branchId] });
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      notifications.show({
        title: 'Upload failed',
        message: error.response?.data?.message ?? error.message ?? 'Failed to upload file',
        color: 'red',
      });
    },
  });
}

/**
 * Upload a file to assessment draft (create flow). Stores as-is; compression runs when teacher presses Create Assessment.
 */
export function useUploadDraftFile(draftId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<DraftUploadResult> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('draftId', draftId);
      const response = await apiClient.post<{ data: DraftUploadResult }>(
        '/api/v1/assessments/draft/upload',
        formData,
      );
      const body = response.data as { data?: DraftUploadResult } & DraftUploadResult;
      const result = body.data ?? body;
      if (!result?.fileUrl || !result?.draftFileId) {
        throw new Error('Draft upload did not return file URL or draftFileId');
      }
      return result;
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      notifications.show({
        title: 'Upload failed',
        message: error.response?.data?.message ?? error.message ?? 'Failed to upload file',
        color: 'red',
      });
    },
  });
}

/**
 * Compress one draft file (image/video). Call when teacher presses Create Assessment to compress all with progress.
 */
export function useCompressDraftFile(draftId: string) {
  return useMutation({
    mutationFn: async (draftFileId: string): Promise<{ fileSizeBytes: number }> => {
      const response = await apiClient.post<{ data: { fileSizeBytes: number } }>(
        `/api/v1/assessments/draft/${draftId}/files/${draftFileId}/compress`,
      );
      const body = response.data as { data?: { fileSizeBytes: number } } & { fileSizeBytes: number };
      return body.data ?? body;
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      notifications.show({
        title: 'Compression failed',
        message: error.response?.data?.message ?? error.message ?? 'Failed to compress file',
        color: 'red',
      });
    },
  });
}

/**
 * Remove a file from assessment draft
 */
export function useDeleteDraftFile(draftId: string) {
  return useMutation({
    mutationFn: async (draftFileId: string): Promise<void> => {
      await apiClient.delete(
        `/api/v1/assessments/draft/${draftId}/files/${draftFileId}`,
      );
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      notifications.show({
        title: 'Remove failed',
        message: error.response?.data?.message ?? error.message ?? 'Failed to remove file',
        color: 'red',
      });
    },
  });
}

/**
 * Hook to delete an attachment
 */
export function useDeleteAssessmentAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string): Promise<{ id: string }> => {
      const response = await apiClient.delete<{ id: string }>(
        `/api/v1/assessments/attachments/${attachmentId}`,
      );
      return response.data;
    },
    onSuccess: (_, attachmentId) => {
      // Invalidate all assessment attachments queries
      queryClient.invalidateQueries({ queryKey: ['assessment-attachments'] });
      notifications.show({
        title: 'Success',
        message: 'File deleted successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete file',
        color: 'red',
      });
    },
  });
}

