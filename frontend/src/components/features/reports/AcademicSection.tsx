'use client';

import { Table, Paper, Text, Skeleton } from '@mantine/core';
import { RankBadge } from './RankBadge';
import { useTranslations } from 'next-intl';
import type { AcademicSection as AcademicSectionType } from '@/types/reports';

interface AcademicSectionProps {
  data: AcademicSectionType | null | undefined;
  isLoading: boolean;
}

export function AcademicSection({ data, isLoading }: AcademicSectionProps) {
  const t = useTranslations('reports');
  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={120} radius="sm" />
      </Paper>
    );
  }

  if (!data || !data.entries || data.entries.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text fw={600} mb="xs">
          {t('academicSectionTitle')}
        </Text>
        <Text c="dimmed" size="sm">
          {t('academicNoGrades')}
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="md">
        {t('academicSectionTitle')}
      </Text>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('academicTableSubject')}</Table.Th>
            <Table.Th>{t('academicTableAssessment')}</Table.Th>
            <Table.Th>{t('academicTableMarks')}</Table.Th>
            <Table.Th>{t('academicTableGrade')}</Table.Th>
            <Table.Th>{t('academicTableRankPercentile')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.entries.map((entry) => (
            <Table.Tr key={entry.assessmentId}>
              <Table.Td>{entry.subjectName}</Table.Td>
              <Table.Td>{entry.assessmentTitle}</Table.Td>
              <Table.Td>
                {entry.marksObtained} / {entry.totalMarks} ({entry.percentage}%)
              </Table.Td>
              <Table.Td>{entry.letterGrade ?? '—'}</Table.Td>
              <Table.Td>
                <RankBadge rank={entry.rank} percentile={entry.percentile} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
