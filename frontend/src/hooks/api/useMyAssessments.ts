'use client';

/**
 * React Query hooks for student \"My Assessments\"
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';

export interface MyAssessmentAttachment {
  id: string;
  assessmentId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  createdAt: string;
}

export type StudentAssessmentStatusValue =
  | 'not_started'
  | 'in_progress'
  | 'submitted';

export interface MyAssessmentStatus {
  assessmentId: string;
  studentId: string;
  status: StudentAssessmentStatusValue;
  isRead: boolean;
  updatedAt: string;
}

export interface MyAssessment {
  assessment: {
    id: string;
    title: string;
    description?: string;
    subjectId: string;
    classSectionId: string;
    totalMarks: number;
    dueDate?: string;
    publishDate?: string;
    isPublished: boolean;
    allowLateSubmission: boolean;
  };
  status?: MyAssessmentStatus;
  attachments: MyAssessmentAttachment[];
}

/**
 * Get assessments for the current student
 */
export function useMyAssessments(enabled = true) {
  return useQuery({
    queryKey: ['my-assessments'],
    queryFn: async (): Promise<MyAssessment[]> => {
      const response = await apiClient.get<MyAssessment[]>(
        '/api/v1/assessments/my',
      );
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

/**
 * Update current student's status for an assessment
 */
export function useUpdateMyAssessmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assessmentId: string;
      status?: StudentAssessmentStatusValue;
      isRead?: boolean;
    }): Promise<MyAssessmentStatus> => {
      const { assessmentId, status, isRead } = params;
      const response = await apiClient.post<MyAssessmentStatus>(
        `/api/v1/assessments/${assessmentId}/my-status`,
        { status, isRead },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-assessments'] });
      notifications.show({
        title: 'Updated',
        message: 'Assessment status updated',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message:
          error.response?.data?.message ||
          'Failed to update assessment status',
        color: 'red',
      });
    },
  });
}



