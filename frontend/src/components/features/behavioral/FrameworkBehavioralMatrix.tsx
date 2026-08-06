'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Skeleton,
  Table,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type {
  ClassFrameworkReport,
  FrameworkPreset,
} from '@/types/behavioral-framework';
import { StudentFrameworkRatingForm } from './StudentFrameworkRatingForm';

interface FrameworkBehavioralMatrixProps {
  report: ClassFrameworkReport | null;
  preset: FrameworkPreset | null;
  isLoading: boolean;
  onSaved?: () => void;
}

export function FrameworkBehavioralMatrix({
  report,
  preset,
  isLoading,
  onSaved,
}: FrameworkBehavioralMatrixProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('behavioral');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const categories = useMemo(
    () => [...(preset?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [preset?.categories],
  );

  const selectedStudent = useMemo(
    () => report?.students.find((s) => s.studentId === selectedStudentId) ?? null,
    [report?.students, selectedStudentId],
  );

  if (isLoading || !report) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={160} radius="sm" />
      </Paper>
    );
  }

  if (!preset) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed" size="sm">
          {t('frameworkNoPresetConfigured')}
        </Text>
      </Paper>
    );
  }

  if (report.students.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed" size="sm">
          {t('noStudentsInSection')}
        </Text>
      </Paper>
    );
  }

  return (
    <>
      <Paper withBorder p="md">
        <ScrollArea type="auto">
          <Table
            id="behavior-framework-matrix-table"
            withTableBorder
            withColumnBorders
            striped
            miw={isMobile ? 520 : undefined}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('student')}</Table.Th>
                {categories.map((cat) => (
                  <Table.Th key={cat.id}>{cat.categoryName}</Table.Th>
                ))}
                <Table.Th>{t('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.students.map((student) => {
                const name =
                  `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() ||
                  student.schoolStudentId;
                const scoreMap = Object.fromEntries(
                  (student.rating?.categoryScores ?? []).map((s) => [
                    s.categoryId,
                    s.ratingCode,
                  ]),
                );
                return (
                  <Table.Tr key={student.studentId}>
                    <Table.Td>
                      <Text size="sm">{name}</Text>
                    </Table.Td>
                    {categories.map((cat) => (
                      <Table.Td key={cat.id}>
                        {scoreMap[cat.id] ? (
                          <Badge variant="light" size="sm">
                            {scoreMap[cat.id]}
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                    ))}
                    <Table.Td>
                      <Button
                        id={`behavior-framework-matrix-rate-${student.studentId}`}
                        size="xs"
                        variant="light"
                        onClick={() => setSelectedStudentId(student.studentId)}
                      >
                        {student.rating ? t('frameworkEdit') : t('frameworkRate')}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {selectedStudent ? (
        <StudentFrameworkRatingForm
          opened={!!selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          student={selectedStudent}
          assessmentMonth={report.assessmentMonth}
          preset={preset}
          existingRating={selectedStudent.rating}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}
