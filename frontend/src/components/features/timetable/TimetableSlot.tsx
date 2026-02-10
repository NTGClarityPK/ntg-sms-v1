'use client';

import { Badge, Card, Stack, Text, Group, useMantineTheme } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { TimetableSlot } from '@/types/timetable';
import type { ThemeConfig } from '@/lib/theme/themeConfig';

interface TimetableSlotProps {
  slot: TimetableSlot;
  onClick?: () => void;
  showConflict?: boolean;
  height?: number; // Optional: card height in pixels to determine if compact layout needed
}

const slotTypeColors: Record<TimetableSlot['slotType'], string> = {
  class: 'blue',
  assembly: 'orange',
  break: 'yellow',
};

// Calculate duration in minutes from time strings
const calculateDurationMinutes = (startTime: string, endTime: string): number => {
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return Math.max(0, end - start);
};

export function TimetableSlotComponent({
  slot,
  onClick,
  showConflict,
  height,
}: TimetableSlotProps) {
  const theme = useMantineTheme();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  // Use surface color which is very close to white (#f8f9fa) but still visible
  const cardBackgroundColor = themeConfig?.colors?.surface || '#f8f9fa';

  // Calculate duration in minutes
  const durationMinutes = calculateDurationMinutes(slot.startTime, slot.endTime);
  const isCompact = durationMinutes < 15 || (height !== undefined && height < 50);

  // Format time range (remove seconds if present)
  const formatTime = (time: string): string => {
    return time.split(':').slice(0, 2).join(':');
  };
  const timeRange = `${formatTime(slot.startTime)}-${formatTime(slot.endTime)}`;

  // Get period name
  const periodName = slot.subjectName 
    ? slot.subjectName 
    : slot.slotType === 'assembly' 
    ? 'Assembly' 
    : slot.slotType === 'break' 
    ? 'Break' 
    : '';

  if (isCompact) {
    // Compact single-line layout for small slots
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
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: '2px 8px',
        }}
        onClick={onClick}
        withBorder={!showConflict}
      >
        <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Text size="xs" fw={500} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
            {periodName}
          </Text>
          {slot.staffName && (
            <Text 
              size="xs" 
              c="dimmed" 
              lineClamp={1} 
              style={{ 
                whiteSpace: 'nowrap',
                maxWidth: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {slot.staffName}
            </Text>
          )}
          {slot.room && (
            <Badge 
              size="xs" 
              variant="light" 
              color="blue"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              R:{slot.room}
            </Badge>
          )}
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {timeRange}
          </Text>
          {showConflict && (
            <IconAlertCircle size={12} color="var(--mantine-color-red-6)" style={{ flexShrink: 0 }} />
          )}
        </Group>
      </Card>
    );
  }

  // Regular layout for larger slots
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
        position: 'relative',
      }}
      onClick={onClick}
      withBorder={!showConflict}
    >
      <Badge 
        size="xs" 
        variant="light" 
        color={slotTypeColors[slot.slotType]}
        style={{ 
          position: 'absolute', 
          top: 4, 
          right: slot.periodNumber ? 70 : 4,
          zIndex: 1
        }}
      >
        {slot.slotType === 'class' 
          ? 'class' 
          : 'others'}
      </Badge>
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

