'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import { useAssessments } from '@/hooks/api/useAssessments';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function PendingGradingWidget() {
  const colors = useThemeColors();
  const { data, isLoading, error } = useAssessments({
    limit: 10,
    page: 1,
  });

  const assessments = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

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
        <Skeleton height={40} />
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {total} assessment{total !== 1 ? 's' : ''} in the system.
      </Text>
    </Stack>
  );
}
