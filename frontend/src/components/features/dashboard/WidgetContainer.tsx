'use client';

import { Paper, Stack, Text, Skeleton, Alert } from '@mantine/core';
import type { ReactNode } from 'react';
import type { DashboardWidget } from '@/types/dashboard';

interface WidgetContainerProps {
  widget: DashboardWidget;
  isLoading?: boolean;
  error?: Error | null;
  children: ReactNode;
}

export function WidgetContainer({
  widget,
  isLoading,
  error,
  children,
}: WidgetContainerProps) {
  if (error) {
    return (
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            {widget.title}
          </Text>
          <Alert color="red" title="Error">
            {error instanceof Error ? error.message : 'Something went wrong'}
          </Alert>
        </Stack>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Skeleton height={20} width="60%" />
          <Skeleton height={80} />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          {widget.title}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}
