import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkImportApi,
  type BulkImportPreview,
  type BulkImportResult,
  type BulkStudentRowDto,
  type BulkUserImportPreview,
  type BulkUserImportResult,
  type BulkUserRowDto,
} from '@/lib/api/bulk-import';
import type { SubjectTemplateHelpResponse } from '@/lib/api/bulk-import';

export function useBulkImportPreview() {
  return useMutation({
    mutationFn: (file: File) => bulkImportApi.previewStudents(file),
  });
}

export function useBulkImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rows,
      academicYearId,
    }: {
      rows: BulkStudentRowDto[];
      academicYearId: string;
    }) => bulkImportApi.importStudents(rows, academicYearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useBulkImportValidate() {
  return useMutation({
    mutationFn: (rows: BulkStudentRowDto[]) => bulkImportApi.validateStudents(rows),
  });
}

export function useBulkImportTemplate() {
  return useQuery({
    queryKey: ['bulk-import-template', 'students'],
    queryFn: () => bulkImportApi.getTemplate(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBulkStudentsExport() {
  return useMutation({
    mutationFn: (academicYearId?: string) => bulkImportApi.exportStudents(academicYearId),
  });
}

export function useSubjectTemplateHelp(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bulk-import-subject-template-help'],
    queryFn: () => bulkImportApi.getSubjectTemplateHelp(),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: options?.enabled ?? false,
  });
}

export function useBulkUsersImportPreview() {
  return useMutation({
    mutationFn: (file: File) => bulkImportApi.previewUsers(file),
  });
}

export function useBulkUsersImportValidate() {
  return useMutation({
    mutationFn: (rows: BulkUserRowDto[]) => bulkImportApi.validateUsers(rows),
  });
}

export function useBulkUsersImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: BulkUserRowDto[]) => bulkImportApi.importUsers(rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}

export function useBulkUsersExport() {
  return useMutation({
    mutationFn: () => bulkImportApi.exportUsers(),
  });
}

export function useBulkUsersImportTemplate() {
  return useQuery({
    queryKey: ['bulk-import-template', 'users'],
    queryFn: () => bulkImportApi.getUsersTemplate(),
    staleTime: 5 * 60 * 1000,
  });
}

export type {
  BulkImportPreview,
  BulkImportResult,
  BulkStudentRowDto,
  BulkUserImportPreview,
  BulkUserImportResult,
  BulkUserRowDto,
  SubjectTemplateHelpResponse,
};
