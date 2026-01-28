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
      // Backend controller returns { data: { classTeacherOf: [...], subjectAssignments: [...] } }
      // ResponseInterceptor sees it has 'data' property and returns as-is: { data: StaffSchedule }
      // HTTP response body: { data: StaffSchedule }
      // Axios response.data: { data: StaffSchedule }
      // apiClient.get<StaffSchedule>() returns ApiResponse<StaffSchedule> = { data: StaffSchedule, meta?: {...} }
      // Component expects: scheduleData?.data where scheduleData is { data: StaffSchedule }
      const response = await apiClient.get<StaffSchedule>(
        `/api/v1/staff/${staffId}/schedule`,
      );
      // Return response as-is so component can access scheduleData?.data
      return response;
    },
    enabled: !!staffId && !!branchId,
  });
}

