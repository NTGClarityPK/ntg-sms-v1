'use client';

import { Stack, Text, Progress, Skeleton, Alert } from '@mantine/core';
import { useStorageOverview } from '@/hooks/useStorage';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function StorageWidget() {
  const colors = useThemeColors();
  const { data: overview, isLoading, error } = useStorageOverview();

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load storage'}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={20} width="60%" />
        <Skeleton height={24} />
      </Stack>
    );
  }

  const usedPct = overview?.usedPercentage ?? 0;
  const usedGb = ((overview?.usedBytes ?? 0) / (1024 * 1024 * 1024)).toFixed(2);
  const quotaGb = overview?.quotaGb ?? 0;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {usedGb} GB of {quotaGb} GB used
      </Text>
      <Progress value={Math.min(usedPct, 100)} color={usedPct > 90 ? colors.error : colors.info} />
    </Stack>
  );
}
