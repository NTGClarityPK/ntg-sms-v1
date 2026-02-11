'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  StudentReport,
  AcademicSection,
  AttendanceSection,
  ClassReport,
  Rankings,
} from '@/types/reports';
import { useAuth } from './useAuth';

/** No meta on report endpoints → return response.data. */

export function useStudentReport(studentId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'student', studentId, academicYearId, branchId],
    queryFn: async (): Promise<StudentReport | null> => {
      if (!studentId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<StudentReport>(
        `/api/v1/reports/student/${studentId}${params}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStudentAcademicReport(studentId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'student-academic', studentId, academicYearId, branchId],
    queryFn: async (): Promise<AcademicSection | null> => {
      if (!studentId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<AcademicSection>(
        `/api/v1/reports/student/${studentId}/academic${params}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStudentAttendanceReport(studentId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'student-attendance', studentId, academicYearId, branchId],
    queryFn: async (): Promise<AttendanceSection | null> => {
      if (!studentId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<AttendanceSection>(
        `/api/v1/reports/student/${studentId}/attendance${params}`,
      );
      return response.data;
    },
    enabled: !!studentId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useClassReport(classSectionId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'class', classSectionId, academicYearId, branchId],
    queryFn: async (): Promise<ClassReport | null> => {
      if (!classSectionId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<ClassReport>(
        `/api/v1/reports/class/${classSectionId}${params}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useRankings(
  classSectionId: string | null,
  subjectId: string | null,
  academicYearId?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'rankings', classSectionId, subjectId, academicYearId, branchId],
    queryFn: async (): Promise<Rankings | null> => {
      if (!classSectionId || !subjectId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<Rankings>(
        `/api/v1/reports/rankings/${classSectionId}/${subjectId}${params}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!subjectId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}
