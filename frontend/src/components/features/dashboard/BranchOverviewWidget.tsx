'use client';

import { Stack, Text, Group, Skeleton, Alert } from '@mantine/core';
import { IconSchool, IconUsers } from '@tabler/icons-react';
import { useStudents } from '@/hooks/useStudents';
import { useStaff } from '@/hooks/useStaff';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function BranchOverviewWidget() {
  const colors = useThemeColors();
  const studentsQuery = useStudents({ limit: 1, page: 1 });
  const staffQuery = useStaff({ limit: 1, page: 1 });

  const studentsTotal = studentsQuery.data?.meta?.total ?? 0;
  const staffTotal = staffQuery.data?.meta?.total ?? 0;
  const isLoading = studentsQuery.isLoading || staffQuery.isLoading;
  const error = studentsQuery.error ?? staffQuery.error;

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load statistics'}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={24} width="60%" />
        <Skeleton height={50} />
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="lg">
        <Stack gap={2} align="center">
          <IconSchool size={24} />
          <Text size="sm" fw={600}>
            {studentsTotal}
          </Text>
          <Text size="xs" c="dimmed">
            Students
          </Text>
        </Stack>
        <Stack gap={2} align="center">
          <IconUsers size={24} />
          <Text size="sm" fw={600}>
            {staffTotal}
          </Text>
          <Text size="xs" c="dimmed">
            Staff
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
}
