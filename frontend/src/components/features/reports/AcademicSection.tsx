'use client';

import { Table, Paper, Text, Skeleton } from '@mantine/core';
import { RankBadge } from './RankBadge';
import type { AcademicSection as AcademicSectionType } from '@/types/reports';

interface AcademicSectionProps {
  data: AcademicSectionType | null | undefined;
  isLoading: boolean;
}

export function AcademicSection({ data, isLoading }: AcademicSectionProps) {
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
        <Text fw={600} mb="xs">Academic</Text>
        <Text c="dimmed" size="sm">No grades recorded.</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="md">Academic</Text>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Subject</Table.Th>
            <Table.Th>Assessment</Table.Th>
            <Table.Th>Marks</Table.Th>
            <Table.Th>Grade</Table.Th>
            <Table.Th>Rank / Percentile</Table.Th>
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
