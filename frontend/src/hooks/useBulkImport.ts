import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkImportApi,
  type BulkImportPreview,
  type BulkImportResult,
  type BulkStudentRowDto,
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

export function useSubjectTemplateHelp(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['bulk-import-subject-template-help'],
    queryFn: () => bulkImportApi.getSubjectTemplateHelp(),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: options?.enabled ?? false,
  });
}

export type { BulkImportPreview, BulkImportResult, BulkStudentRowDto };
