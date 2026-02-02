import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  TimetableSlot,
  ClassTimetable,
  TeacherTimetable,
  Conflict,
  CreateTimetableSlotInput,
  GenerateTimetableInput,
  TimingTemplateInfo,
} from '@/types/timetable';
import { useAuth } from './useAuth';
import { useMyStaff } from './useStaff';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function useClassTimetable(
  classSectionId: string | null,
  academicYearId?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['timetable', 'class', classSectionId, academicYearId, branchId],
    queryFn: async () => {
      if (!classSectionId || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (academicYearId) queryParams.append('academicYearId', academicYearId);

      const response = await apiClient.get<ClassTimetable>(
        `/api/v1/timetable/class/${classSectionId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      return response;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useTeacherTimetable(
  staffId: string | null,
  academicYearId?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['timetable', 'teacher', staffId, academicYearId, branchId],
    queryFn: async () => {
      if (!staffId || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (academicYearId) queryParams.append('academicYearId', academicYearId);

      const response = await apiClient.get<TeacherTimetable>(
        `/api/v1/timetable/teacher/${staffId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      return response;
    },
    enabled: !!staffId && !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useMyTimetable(academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { data: myStaff } = useMyStaff();

  return useQuery({
    queryKey: ['timetable', 'teacher', 'me', academicYearId, branchId],
    queryFn: async () => {
      if (!myStaff?.data?.id || !branchId) return null;
      const queryParams = new URLSearchParams();
      if (academicYearId) queryParams.append('academicYearId', academicYearId);

      const response = await apiClient.get<TeacherTimetable>(
        `/api/v1/timetable/teacher/me${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      return response;
    },
    enabled: !!myStaff?.data?.id && !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

interface ConflictFilters {
  classSectionId?: string;
  staffId?: string;
  academicYearId?: string;
}

export function useConflicts(filters?: ConflictFilters) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['timetable', 'conflicts', branchId, filters],
    queryFn: async () => {
      if (!branchId) return null;
      const queryParams = new URLSearchParams();
      if (filters?.classSectionId) queryParams.append('classSectionId', filters.classSectionId);
      if (filters?.staffId) queryParams.append('staffId', filters.staffId);
      if (filters?.academicYearId) queryParams.append('academicYearId', filters.academicYearId);

      const response = await apiClient.get<Conflict[]>(
        `/api/v1/timetable/conflicts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      return response;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCreateOrUpdateSlot() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateTimetableSlotInput) => {
      const response = await apiClient.post<{ data: TimetableSlot }>(
        '/api/v1/timetable/slots',
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate timetable queries
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      // Invalidate conflicts
      queryClient.invalidateQueries({ queryKey: ['timetable', 'conflicts'] });
      notifications.show({
        title: 'Success',
        message: 'Timetable slot saved',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to save timetable slot',
        color: notifyColors.error,
      });
    },
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ data: { success: boolean } }>(
        `/api/v1/timetable/slots/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate timetable queries
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      // Invalidate conflicts
      queryClient.invalidateQueries({ queryKey: ['timetable', 'conflicts'] });
      notifications.show({
        title: 'Success',
        message: 'Timetable slot deleted',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to delete timetable slot',
        color: notifyColors.error,
      });
    },
  });
}

export function useGenerateTimetable() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (input: GenerateTimetableInput) => {
      const response = await apiClient.post<{ data: { slotsCreated: number } }>(
        '/api/v1/timetable/generate',
        input,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate class timetable queries
      queryClient.invalidateQueries({
        queryKey: ['timetable', 'class', variables.classSectionId],
      });
      // Invalidate conflicts
      queryClient.invalidateQueries({ queryKey: ['timetable', 'conflicts'] });
      notifications.show({
        title: 'Success',
        message: 'Timetable generated successfully',
        color: notifyColors.success,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message: message || 'Failed to generate timetable',
        color: notifyColors.error,
      });
    },
  });
}

export function useTimingTemplateInfo(classSectionId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['timetable', 'template-info', classSectionId, branchId],
    queryFn: async () => {
      if (!classSectionId || !branchId) return null;
      const response = await apiClient.get<TimingTemplateInfo>(
        `/api/v1/timetable/class/${classSectionId}/template-info`,
      );
      return response;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for real-time conflict checking of a single slot.
 * Returns a function that checks if a slot would conflict with existing slots.
 */
export function useCheckSlotConflict() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return async (slot: Partial<CreateTimetableSlotInput>): Promise<boolean> => {
    if (!branchId || !slot.startTime || !slot.endTime || !slot.staffId) {
      return false;
    }

    try {
      const queryParams = new URLSearchParams();
      if (slot.classSectionId) queryParams.append('classSectionId', slot.classSectionId);
      if (slot.staffId) queryParams.append('staffId', slot.staffId);
      if (slot.academicYearId) queryParams.append('academicYearId', slot.academicYearId);

      const response = await apiClient.get<Conflict[]>(
        `/api/v1/timetable/conflicts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      );
      
      const conflicts = response.data || [];
      
      // Check if any conflict involves the same day and overlapping time
      return conflicts.some((conflict) => {
        if (conflict.dayOfWeek !== slot.dayOfWeek) return false;
        
        // Check if times overlap
        return conflict.conflictingSlots.some((cs) => {
          const slotStart = slot.startTime!;
          const slotEnd = slot.endTime!;
          const conflictStart = cs.startTime;
          const conflictEnd = cs.endTime;
          
          // Times overlap if: slotStart < conflictEnd && slotEnd > conflictStart
          return slotStart < conflictEnd && slotEnd > conflictStart;
        });
      });
    } catch {
      // If check fails, don't block user - return false (no conflict detected)
      return false;
    }
  };
}

