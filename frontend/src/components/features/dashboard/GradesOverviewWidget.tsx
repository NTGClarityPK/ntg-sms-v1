'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import type { StudentGrade } from '@/types/assessment';
import { useMyStudent } from '@/hooks/useStudents';
import { useStudentGrades } from '@/hooks/api/useGrades';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function GradesOverviewWidget() {
  const colors = useThemeColors();
  const { data: myStudentData } = useMyStudent();
  const studentId = myStudentData?.data?.id ?? undefined;
  const { data: gradesData, isLoading, error } = useStudentGrades(studentId);
  const grades: StudentGrade[] = Array.isArray(gradesData)
    ? gradesData
    : (gradesData as { data?: StudentGrade[] } | undefined)?.data ?? [];

  if (!studentId) {
    return null;
  }

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load grades'}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={20} width="70%" />
        <Skeleton height={50} />
      </Stack>
    );
  }

  const recent = grades.slice(0, 5);

  return (
    <Stack gap="sm">
      {recent.length === 0 ? (
        <Text size="sm" c="dimmed">
          No grades recorded yet
        </Text>
      ) : (
        recent.map((g) => (
          <Text key={g.id} size="sm">
            Assessment – {g.marksObtained} marks
          </Text>
        ))
      )}
    </Stack>
  );
}
