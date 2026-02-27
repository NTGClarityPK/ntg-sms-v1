'use client';

import { useState } from 'react';
import { Button, Group, Menu, Text } from '@mantine/core';
import { IconFileExport, IconFileTypePdf, IconFileSpreadsheet } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

export type ExportVariant = 'student' | 'class';

export interface ExportButtonProps {
  /** 'student' = PDF + Excel; 'class' = Excel only */
  variant: ExportVariant;
  /** Student ID (required when variant is 'student') */
  studentId?: string;
  /** Class section ID (required when variant is 'class') */
  classSectionId?: string;
  /** Optional academic year ID for report period */
  academicYearId?: string | null;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Button with dropdown to export report as PDF (student only) or Excel.
 * Uses authenticated API; shows progress while export is in progress.
 */
export function ExportButton({
  variant,
  studentId,
  classSectionId,
  academicYearId,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('reports');

  const buildUrl = (path: string): string => {
    const base = path.startsWith('/') ? path : `/${path}`;
    const params = new URLSearchParams();
    if (academicYearId) params.set('academicYearId', academicYearId);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    setError(null);
    setLoading(true);

    try {
      if (variant === 'student' && studentId) {
        const path =
          format === 'pdf'
            ? `/api/v1/reports/student/${studentId}/export/pdf`
            : `/api/v1/reports/student/${studentId}/export/excel`;
        const blob = await apiClient.getBlob(buildUrl(path));
        const ext = format === 'pdf' ? 'pdf' : 'xlsx';
        triggerDownload(blob, `student-report-${studentId}.${ext}`);
      } else if (variant === 'class' && classSectionId && format === 'excel') {
        const path = `/api/v1/reports/class/${classSectionId}/export/excel`;
        const blob = await apiClient.getBlob(buildUrl(path));
        triggerDownload(blob, `class-report-${classSectionId}.xlsx`);
      }
    } catch {
      setError(t('exportFailed'));
    } finally {
      setLoading(false);
    }
  };

  const studentOptions = [
    { format: 'pdf' as const, label: t('adminExportPdf'), icon: IconFileTypePdf },
    { format: 'excel' as const, label: t('adminExportExcel'), icon: IconFileSpreadsheet },
  ];

  const classOptions = [
    { format: 'excel' as const, label: t('adminExportExcel'), icon: IconFileSpreadsheet },
  ];

  const options = variant === 'student' ? studentOptions : classOptions;
  const canExport =
    (variant === 'student' && studentId) || (variant === 'class' && classSectionId);

  return (
    <Group gap="sm" align="center">
      <Menu shadow="md" width={180} disabled={!canExport || loading}>
        <Menu.Target>
          <Button
            leftSection={loading ? undefined : <IconFileExport size={16} />}
            variant="light"
            loading={loading}
            disabled={!canExport}
          >
            {t('adminExport')}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {options.map(({ format, label, icon: Icon }) => (
            <Menu.Item
              key={format}
              leftSection={<Icon size={14} />}
              onClick={() => handleExport(format)}
              disabled={loading}
            >
              {label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
    </Group>
  );
}
