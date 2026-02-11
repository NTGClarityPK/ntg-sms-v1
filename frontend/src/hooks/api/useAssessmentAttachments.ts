'use client';

/**
 * React Query hooks for assessment attachments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import type { ApiResponse } from '@/types/api';

export interface AssessmentAttachment {
  id: string;
  assessmentId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType?: string;
  createdAt: string;
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

