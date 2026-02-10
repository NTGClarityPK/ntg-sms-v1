'use client';

import { Badge, Card, Stack, Text, Group, useMantineTheme } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { TimetableSlot } from '@/types/timetable';
import type { ThemeConfig } from '@/lib/theme/themeConfig';

interface TimetableSlotProps {
  slot: TimetableSlot;
  onClick?: () => void;
  showConflict?: boolean;
}

const slotTypeColors: Record<TimetableSlot['slotType'], string> = {
  class: 'blue',
  assembly: 'orange',
  break: 'yellow',
};

export function TimetableSlotComponent({
  slot,
  onClick,
  showConflict,
}: TimetableSlotProps) {
  const theme = useMantineTheme();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  // Use surface color which is very close to white (#f8f9fa) but still visible
  const cardBackgroundColor = themeConfig?.colors?.surface || '#f8f9fa';

  return (
    <Card
      padding="xs"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        border: showConflict ? '2px solid var(--mantine-color-red-6)' : undefined,
        backgroundColor: showConflict 
          ? 'var(--mantine-color-red-0)' 
          : cardBackgroundColor,
        transition: 'all 0.2s',
      }}
      onClick={onClick}
      withBorder={!showConflict}
    >
      <Stack gap={4}>
        {(slot.staffName || slot.room) && (
          <Group gap={6} wrap="nowrap" style={{ marginBottom: 0 }}>
            {slot.staffName && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {slot.staffName}
              </Text>
            )}
            {slot.room && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                • Room: {slot.room}
              </Text>
            )}
          </Group>
        )}
        <Group justify="space-between" gap={8} wrap="nowrap" style={{ marginTop: (slot.staffName || slot.room) ? -4 : 8 }}>
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {slot.subjectName ? (
              <Text size="sm" fw={500} lineClamp={1}>
                {slot.subjectName}
              </Text>
            ) : slot.slotType === 'assembly' ? (
              <Text size="sm" fw={500} lineClamp={1}>
                Assembly
              </Text>
            ) : slot.slotType === 'break' ? (
              <Text size="sm" fw={500} lineClamp={1}>
                Break
              </Text>
            ) : null}
            <Badge 
              size="xs" 
              variant="light" 
              color={slotTypeColors[slot.slotType]}
              style={{ flexShrink: 0 }}
            >
              {slot.slotType === 'class' 
                ? 'class' 
                : 'others'}
            </Badge>
          </Group>

          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {slot.startTime} - {slot.endTime}
            </Text>
            {showConflict && <IconAlertCircle size={14} color="var(--mantine-color-red-6)" />}
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

