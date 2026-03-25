'use client';

import { useEffect, useState } from 'react';
import {
  Group,
  Title,
  Paper,
  Stack,
  Text,
  Select,
  Table,
  Button,
  Skeleton,
} from '@mantine/core';
import { IconFileDownload } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useClassSections } from '@/hooks/useClassSections';
import {
  useClassSectionResults,
} from '@/hooks/useResults';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { apiClient } from '@/lib/api-client';
import type { ClassSection } from '@/types/class-sections';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import { useMyStaff } from '@/hooks/useStaff';

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

export default function ResultsPage() {
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const t = useTranslations('results');
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: myStaffData } = useMyStaff();
  const staffData = myStaffData?.data;
  const classSectionsQuery = useClassSections({ limit: 200, minimal: true });
  const activeYearQuery = useActiveAcademicYear();
  const activeYear = activeYearQuery.data?.data ?? null;
  const academicYearId = activeYear?.id;

  const resultsQuery = useClassSectionResults(classSectionId ?? null, academicYearId, 'final');
  const results = resultsQuery.data ?? null;

  const isClassTeacher =
    userTyped?.roles?.some((r) => r.roleName === 'class_teacher') ?? false;

  // Auto-select sole class-section for class teachers
  useEffect(() => {
    const list = (classSectionsQuery.data?.data as ClassSection[] | undefined) ?? [];
    if (isClassTeacher && staffData?.id) {
      // Filter to only sections where this staff member is class teacher
      const ownSections = list.filter((cs) => cs.classTeacherId === staffData.id);
      if (ownSections.length === 1 && !classSectionId) {
        setClassSectionId(ownSections[0]!.id);
      }
    }
  }, [isClassTeacher, staffData?.id, classSectionId, classSectionsQuery.data]);

  const classList = (classSectionsQuery.data?.data as ClassSection[] | undefined) ?? [];
  const visibleClassSections =
    isClassTeacher && staffData?.id
      ? classList.filter((cs) => cs.classTeacherId === staffData.id)
      : classList;
  const classOptions = visibleClassSections
    .sort((a, b) => {
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));

  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const handleStudentPdf = async (
    studentId: string,
    reportType: 'basic' | 'detailed',
  ) => {
    if (!classSectionId) return;
    const key = `${studentId}-final-${reportType}`;
    setDownloadingPdf(key);
    try {
      const params = new URLSearchParams();
      params.set('classSectionId', classSectionId);
      params.set('resultType', 'final');
      params.set('reportType', reportType);
      if (academicYearId) params.set('academicYearId', academicYearId);
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/student/${studentId}/result-card/pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `result-card-${studentId}-final.pdf`);
    } catch {
      // Error already shown by api client / notifications
    } finally {
      setDownloadingPdf(null);
    }
  };

  const renderBasicButton = (studentId: string) => (
    <Button
      size="xs"
      variant="light"
      loading={downloadingPdf === `${studentId}-final-basic`}
      onClick={() => handleStudentPdf(studentId, 'basic')}
    >
      {t('basicReportCard')}
    </Button>
  );

  const renderDetailedButton = (studentId: string) => (
    <Button
      size="xs"
      variant="light"
      loading={downloadingPdf === `${studentId}-final-detailed`}
      onClick={() => handleStudentPdf(studentId, 'detailed')}
    >
      {t('detailedReportCard')}
    </Button>
  );

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
        </Group>
      </div>
      <div className="page-sub-title-bar" />

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Stack gap="md">
              {visibleClassSections.length > 1 && (
                <Select
                  label={t('classSectionLabel')}
                  placeholder={t('classSectionPlaceholder')}
                  data={classOptions}
                  value={classSectionId}
                  onChange={setClassSectionId}
                  clearable
                  searchable
                  style={{ maxWidth: 400 }}
                />
              )}
              {activeYear && (
                <Text size="sm" c="dimmed">
                  {t('academicYearLabel')}: {activeYear.name}
                </Text>
              )}
              {classSectionId && (
                (() => {
                  const selected =
                    visibleClassSections.find((cs) => cs.id === classSectionId) ?? null;
                  return selected ? (
                    <Text size="sm" c="dimmed">
                      {t('classLabel')}: {(selected.className ?? '')}{' '}
                      {(selected.sectionName ?? '')}
                    </Text>
                  ) : null;
                })()
              )}
            </Stack>
          </Paper>

          {!classSectionId && visibleClassSections.length > 1 ? (
            <Text c="dimmed" size="sm">
              {t('classSectionHint')}
            </Text>
          ) : (
            <>
              {resultsQuery.isLoading ? (
                <Skeleton height={200} radius="sm" />
              ) : !results?.students?.length ? (
                <Text c="dimmed">{t('noStudents')}</Text>
              ) : (
                <>
                  {/* Top 3 banner */}
                  <Paper withBorder p="md">
                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        {t('topStudentsTitle')}
                      </Text>
                      {([...results.students]
                        .filter((s) => s.overallPercentage != null)
                        .sort(
                          (a, b) =>
                            (b.overallPercentage ?? 0) - (a.overallPercentage ?? 0),
                        )
                        .slice(0, 3) as typeof results.students
                      ).map((s, index) => (
                        <Text key={s.studentId} size="sm">
                          {index + 1}
                          {index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'} position: {s.studentName}{' '}
                          ({s.overallPercentage}%)
                        </Text>
                      ))}
                    </Stack>
                  </Paper>
                  {/* Results table */}
                  <Paper withBorder p="md">
                    <Table withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('studentName')}</Table.Th>
                          <Table.Th>{t('basicReportCard')}</Table.Th>
                          <Table.Th>{t('detailedReportCard')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {results.students.map((s) => (
                          <Table.Tr key={s.studentId}>
                            <Table.Td>{s.studentName}</Table.Td>
                            <Table.Td>{renderBasicButton(s.studentId)}</Table.Td>
                            <Table.Td>{renderDetailedButton(s.studentId)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </>
              )}
            </>
          )}
        </Stack>
      </div>
    </>
  );
}
