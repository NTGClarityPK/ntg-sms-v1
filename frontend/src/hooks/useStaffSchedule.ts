'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './useAuth';

export interface StaffSchedule {
  classTeacherOf: Array<{
    classSectionId: string;
    className: string;
    sectionName: string;
  }>;
  subjectAssignments: Array<{
    subjectId: string;
    subjectName: string;
    classSectionId: string;
  }>;
}

export function useStaffSchedule(staffId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['staff-schedule', staffId, branchId],
    queryFn: async () => {
      if (!staffId || !branchId) return null;
      const response = await apiClient.get<{ data: StaffSchedule }>(
        `/api/v1/staff/${staffId}/schedule`,
      );
      return response.data;
    },
    enabled: !!staffId && !!branchId,
  });
}

