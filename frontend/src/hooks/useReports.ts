'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  StudentReport,
  AcademicSection,
  AttendanceSection,
  ClassReport,
  Rankings,
  AttendanceReportByClass,
  AttendanceSummaryBranch,
  LowAttendanceReport,
  AcademicReportBySubject,
  AcademicComparison,
} from '@/types/reports';
import { ReportPeriodType } from '@/types/reports';
import { useAuth } from './useAuth';

/** No meta on report endpoints → return response.data. */

export function useStudentReport(
  studentId: string | null,
  academicYearId?: string,
  periodType?: ReportPeriodType | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'student', studentId, academicYearId, branchId, periodType, startDate, endDate],
    queryFn: async (): Promise<StudentReport | null> => {
      if (!studentId || !branchId) return null;
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (periodType) params.append('periodType', periodType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const queryString = params.toString();
      const url = `/api/v1/reports/student/${studentId}${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient.get<StudentReport>(url);
      return response.data;
    },
    enabled: !!studentId && !!branchId && !(periodType === ReportPeriodType.CUSTOM && (!startDate || !endDate)),
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

export interface ClassStudentCount {
  classSectionId: string;
  className: string;
  sectionName: string;
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
}

export function usePublicClassCounts(academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'public', 'class-counts', branchId, academicYearId],
    queryFn: async (): Promise<ClassStudentCount[]> => {
      if (!branchId) return [];
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<ClassStudentCount[]>(
        `/api/v1/reports/public/class-counts${params}`,
      );
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes - counts don't change frequently
  });
}

export function useClassStudentCounts(classSectionId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'public', 'class-counts', classSectionId, branchId, academicYearId],
    queryFn: async (): Promise<ClassStudentCount | null> => {
      if (!classSectionId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<ClassStudentCount>(
        `/api/v1/reports/public/class/${classSectionId}/counts${params}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

// --- Administrative Reports (no meta → return response.data) ---

export function useAttendanceSummary(
  startDate: string | null,
  endDate: string | null,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'attendance', 'summary', branchId, startDate, endDate],
    queryFn: async (): Promise<AttendanceSummaryBranch | null> => {
      if (!branchId || !startDate || !endDate) return null;
      const params = new URLSearchParams({ startDate, endDate });
      const response = await apiClient.get<AttendanceSummaryBranch>(
        `/api/v1/reports/attendance/summary?${params}`,
        { timeout: 60000 },
      );
      return response.data;
    },
    enabled:
      !!branchId &&
      !!startDate &&
      !!endDate &&
      (options?.enabled !== false),
    staleTime: 2 * 60 * 1000,
  });
}

export function useLowAttendance(
  startDate: string | null,
  endDate: string | null,
  threshold: number = 80,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'attendance', 'low', branchId, startDate, endDate, threshold],
    queryFn: async (): Promise<LowAttendanceReport | null> => {
      if (!branchId || !startDate || !endDate) return null;
      const params = new URLSearchParams({ startDate, endDate, threshold: String(threshold) });
      const response = await apiClient.get<LowAttendanceReport>(
        `/api/v1/reports/attendance/low-attendance?${params}`,
        { timeout: 60000 },
      );
      return response.data;
    },
    enabled:
      !!branchId &&
      !!startDate &&
      !!endDate &&
      (options?.enabled !== false),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAttendanceReportByClass(
  classSectionId: string | null,
  startDate: string | null,
  endDate: string | null,
  academicYearId?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: [
      'reports',
      'attendance',
      'class',
      classSectionId,
      branchId,
      startDate,
      endDate,
      academicYearId,
    ],
    queryFn: async (): Promise<AttendanceReportByClass | null> => {
      if (!classSectionId || !branchId) return null;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (academicYearId) params.append('academicYearId', academicYearId);
      const q = params.toString();
      const response = await apiClient.get<AttendanceReportByClass>(
        `/api/v1/reports/attendance/class/${classSectionId}${q ? `?${q}` : ''}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAcademicReportByClass(classSectionId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'academic', 'class', classSectionId, branchId, academicYearId],
    queryFn: async (): Promise<ClassReport | null> => {
      if (!classSectionId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<ClassReport>(
        `/api/v1/reports/academic/class/${classSectionId}${params}`,
      );
      return response.data;
    },
    enabled: !!classSectionId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAcademicReportBySubject(subjectId: string | null, academicYearId?: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['reports', 'academic', 'subject', subjectId, branchId, academicYearId],
    queryFn: async (): Promise<AcademicReportBySubject | null> => {
      if (!subjectId || !branchId) return null;
      const params = academicYearId ? `?academicYearId=${academicYearId}` : '';
      const response = await apiClient.get<AcademicReportBySubject>(
        `/api/v1/reports/academic/subject/${subjectId}${params}`,
      );
      return response.data;
    },
    enabled: !!subjectId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAcademicComparison(
  classSectionIds: string[] | null,
  subjectIds: string[] | null,
  academicYearId?: string,
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: [
      'reports',
      'academic',
      'comparison',
      branchId,
      academicYearId,
      classSectionIds?.join(','),
      subjectIds?.join(','),
    ],
    queryFn: async (): Promise<AcademicComparison | null> => {
      if (!branchId) return null;
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (classSectionIds?.length) params.append('classSectionIds', classSectionIds.join(','));
      if (subjectIds?.length) params.append('subjectIds', subjectIds.join(','));
      const q = params.toString();
      const response = await apiClient.get<AcademicComparison>(
        `/api/v1/reports/academic/comparison${q ? `?${q}` : ''}`,
      );
      return response.data;
    },
    enabled: !!branchId && (!!classSectionIds?.length || !!subjectIds?.length),
    staleTime: 2 * 60 * 1000,
  });
}
