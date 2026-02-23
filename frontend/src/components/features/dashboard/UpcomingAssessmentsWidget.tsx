'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import { useMyAssessments } from '@/hooks/api/useMyAssessments';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function UpcomingAssessmentsWidget() {
  const colors = useThemeColors();
  const { data: assessments = [], isLoading, error } = useMyAssessments();

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load assessments'}
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

  const today = new Date().toISOString().split('T')[0];
  const upcoming = assessments
    .filter((a) => a.assessment.dueDate && a.assessment.dueDate >= today)
    .sort(
      (a, b) =>
        (a.assessment.dueDate ?? '').localeCompare(b.assessment.dueDate ?? ''),
    )
    .slice(0, 5);

  return (
    <Stack gap="sm">
      {upcoming.length === 0 ? (
        <Text size="sm" c="dimmed">
          No upcoming assessments
        </Text>
      ) : (
        upcoming.map((item) => (
          <Text key={item.assessment.id} size="sm">
            {item.assessment.title} – due {item.assessment.dueDate}
          </Text>
        ))
      )}
    </Stack>
  );
}
