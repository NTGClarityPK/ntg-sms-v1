'use client';

import { Loader, Text, Stack } from '@mantine/core';

export interface ExportProgressProps {
  /** Whether an export is in progress */
  loading: boolean;
  /** Optional message shown below the spinner */
  message?: string;
}

/**
 * Displays a spinner and optional message while a report export (PDF/Excel) is in progress.
 */
export function ExportProgress({ loading, message }: ExportProgressProps) {
  if (!loading) return null;

  return (
    <Stack gap="xs" align="center">
      <Loader size="sm" />
      {message && (
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      )}
    </Stack>
  );
}
