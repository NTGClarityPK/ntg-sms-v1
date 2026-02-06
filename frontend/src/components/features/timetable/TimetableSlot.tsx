'use client';

import { Badge, Card, Stack, Text, Group } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { TimetableSlot } from '@/types/timetable';

interface TimetableSlotProps {
  slot: TimetableSlot;
  onClick?: () => void;
  showConflict?: boolean;
}

const slotTypeColors: Record<TimetableSlot['slotType'], string> = {
  class: 'blue',
  assembly: 'orange',
  break: 'yellow',
  free: 'gray',
};

export function TimetableSlotComponent({
  slot,
  onClick,
  showConflict,
}: TimetableSlotProps) {
  return (
    <Card
      padding="xs"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        border: showConflict ? '2px solid var(--mantine-color-red-6)' : undefined,
        backgroundColor: showConflict ? 'var(--mantine-color-red-0)' : undefined,
        transition: 'all 0.2s',
      }}
      onClick={onClick}
      withBorder={!showConflict}
    >
      <Stack gap={4}>
        <Group justify="space-between" gap={8} wrap="nowrap" style={{ marginTop: 8 }}>
          {slot.subjectName ? (
            <Text size="sm" fw={500} lineClamp={1}>
              {slot.subjectName}
            </Text>
          ) : (
            <Text size="sm" c="dimmed" lineClamp={1}>
              Free Period
            </Text>
          )}

          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {slot.startTime} - {slot.endTime}
          </Text>
        </Group>

        <Group justify="space-between" gap={4} wrap="nowrap">
          <Badge size="xs" variant="light" color={slotTypeColors[slot.slotType]}>
            {slot.slotType}
          </Badge>
          {showConflict && <IconAlertCircle size={14} color="var(--mantine-color-red-6)" />}
        </Group>
        {slot.staffName && (
          <Text size="xs" c="dimmed">
            {slot.staffName}
          </Text>
        )}
        {slot.room && (
          <Text size="xs" c="dimmed">
            Room: {slot.room}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

