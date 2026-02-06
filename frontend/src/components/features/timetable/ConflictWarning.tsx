'use client';

import { Alert, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { Conflict } from '@/types/timetable';

interface ConflictWarningProps {
  conflict: Conflict;
}

export function ConflictWarning({ conflict }: ConflictWarningProps) {
  return (
    <Alert icon={<IconAlertTriangle size={16} />} color="red" title={conflict.type}>
      <Stack gap="xs">
        <Text size="sm">{conflict.message}</Text>
        {conflict.conflictingSlots.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={500}>
              Conflicting slots:
            </Text>
            {conflict.conflictingSlots.map((slot) => (
              <Text key={slot.id} size="xs" c="dimmed">
                • {slot.className} {slot.sectionName} - {slot.startTime} to {slot.endTime}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Alert>
  );
}




