import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkImportApi,
  type BulkImportPreview,
  type BulkImportResult,
  type BulkStudentRowDto,
} from '@/lib/api/bulk-import';

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

export function useBulkImportTemplate() {
  return useQuery({
    queryKey: ['bulk-import-template', 'students'],
    queryFn: () => bulkImportApi.getTemplate(),
    staleTime: 5 * 60 * 1000,
  });
}

export type { BulkImportPreview, BulkImportResult, BulkStudentRowDto };
