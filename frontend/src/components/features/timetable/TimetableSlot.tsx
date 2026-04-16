'use client';

import { Badge, Card, Stack, Text, Group, useMantineTheme } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { TimetableSlot } from '@/types/timetable';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useTheme } from '@/lib/hooks/use-theme';

interface TimetableSlotProps {
  slot: TimetableSlot;
  onClick?: () => void;
  showConflict?: boolean;
  height?: number; // Optional: card height in pixels to determine if compact layout needed
  periodNumber?: number;
}

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
  periodNumber,
}: TimetableSlotProps) {
  const theme = useMantineTheme();
  const colors = useThemeColors();
  const themeConfig = (theme.other as any) as ThemeConfig | undefined;
  const { isDark } = useTheme();
  // Slot background should be slightly lifted from the grid lane in dark mode.
  // Use theme-config surfaces (no hardcoded colours).
  const cardBackgroundColor =
    (isDark ? themeConfig?.colors?.surfaceVariant : themeConfig?.colors?.surface) ??
    themeConfig?.colors?.surface ??
    (isDark ? theme.colors.dark[6] : theme.colors.gray[0]);
  // Class badge uses theme primary; assembly/break keep semantic colors
  const slotTypeColors: Record<TimetableSlot['slotType'], string> = {
    class: colors.primary,
    assembly: 'orange',
    break: 'yellow',
  };

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
          border: showConflict ? '3px solid var(--mantine-color-red-7)' : undefined,
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
          {slot.slotType === 'class' && (slot.className || slot.sectionName) && (
            <Text size="xs" c="dimmed" lineClamp={1} style={{ whiteSpace: 'nowrap' }}>
              {[slot.className, slot.sectionName].filter(Boolean).join(' ')}
            </Text>
          )}
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
              color={colors.primary}
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
  const subjectLabel = slot.subjectName
    ? slot.subjectName
    : slot.slotType === 'assembly'
    ? 'Assembly'
    : slot.slotType === 'break'
    ? 'Break'
    : '';

  return (
    <Card
      padding="xs"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        border: showConflict ? '3px solid var(--mantine-color-red-7)' : undefined,
        backgroundColor: showConflict
          ? 'var(--mantine-color-red-0)'
          : cardBackgroundColor,
        transition: 'all 0.2s',
        position: 'relative',
        padding: '4px 6px',
      }}
      onClick={onClick}
      withBorder={!showConflict}
    >
      <Stack gap={2}>
        {/* Row 1: subject name (left) + period badge (right) */}
        <Group justify="space-between" gap={4} wrap="nowrap">
          <Text size="sm" fw={500} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
            {subjectLabel}
          </Text>
          {periodNumber && (
            <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
              P{periodNumber}
            </Badge>
          )}
        </Group>

        {/* Row 2: class type badge + class/section name */}
        <Group gap={4} wrap="nowrap">
          <Badge size="xs" variant="light" color={slotTypeColors[slot.slotType]}>
            {slot.slotType === 'class' ? 'class' : 'others'}
          </Badge>
          {slot.slotType === 'class' && (slot.className || slot.sectionName) && (
            <Text size="xs" c="dimmed" lineClamp={1} style={{ minWidth: 0 }}>
              {[slot.className, slot.sectionName].filter(Boolean).join(' ')}
            </Text>
          )}
        </Group>

        {/* Row 3: staff/room (left) + time range (right) */}
        <Group justify="space-between" gap={4} wrap="nowrap">
          <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            {slot.staffName && (
              <Text size="xs" c="dimmed" lineClamp={1} style={{ minWidth: 0 }}>
                {slot.staffName}
              </Text>
            )}
            {slot.room && (
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                · RM {slot.room}
              </Text>
            )}
          </Group>
          <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {timeRange}
            </Text>
            {showConflict && <IconAlertCircle size={14} color="var(--mantine-color-red-6)" />}
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

