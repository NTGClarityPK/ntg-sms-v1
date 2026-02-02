'use client';

import { Badge, Card, Stack, Text } from '@mantine/core';
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
        borderColor: showConflict ? 'red' : undefined,
      }}
      onClick={onClick}
      withBorder={showConflict}
    >
      <Stack gap={4}>
        <Badge size="xs" variant="light" color={slotTypeColors[slot.slotType]}>
          {slot.slotType}
        </Badge>
        {slot.subjectName ? (
          <Text size="sm" fw={500}>
            {slot.subjectName}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            Free Period
          </Text>
        )}
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
        <Text size="xs" c="dimmed">
          {slot.startTime} - {slot.endTime}
        </Text>
      </Stack>
    </Card>
  );
}

