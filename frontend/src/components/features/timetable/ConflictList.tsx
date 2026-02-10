'use client';

import { Stack, Text } from '@mantine/core';
import type { Conflict } from '@/types/timetable';
import { ConflictWarning } from './ConflictWarning';

interface ConflictListProps {
  conflicts: Conflict[];
  onResolve?: (conflictId: string) => void;
}

export function ConflictList({ conflicts }: ConflictListProps) {
  if (conflicts.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No conflicts found.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {conflicts.map((conflict, index) => (
        <ConflictWarning key={index} conflict={conflict} />
      ))}
    </Stack>
  );
}





