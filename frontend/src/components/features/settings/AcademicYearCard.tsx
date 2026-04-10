'use client';

import { Badge, Button, Card, Group, List, Stack, Text } from '@mantine/core';
import type { AcademicYear } from '@/types/settings';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useTranslations } from 'next-intl';

function rolloverSummaryLines(year: AcademicYear): string[] {
  const r = year.rollover;
  if (!r) return [];
  const lines: string[] = [];
  const from = r.sourceAcademicYearName?.trim() || 'Source year';
  lines.push(`Rolled over from: ${from}`);
  if (r.carryForward.leaveSettings) {
    lines.push(
      r.result.leaveSettingsCopied && r.result.leaveSettingsCopied > 0
        ? 'Leave settings copied'
        : 'Leave settings selected (none found to copy)',
    );
  }
  if (r.carryForward.teacherAssignments) {
    lines.push(`Teacher assignments: ${r.result.teacherAssignmentsCopied ?? 0} copied`);
  }
  if (r.carryForward.timetableSlots) {
    lines.push(`Timetable slots: ${r.result.timetableSlotsCopied ?? 0} copied`);
  }
  return lines;
}

interface AcademicYearCardProps {
  year: AcademicYear;
  onActivate: (id: string) => void;
  onLock: (year: AcademicYear) => void;
  onRollover?: (year: AcademicYear) => void;
  isActivating: boolean;
  isLocking: boolean;
}

export function AcademicYearCard({
  year,
  onActivate,
  onLock,
  onRollover,
  isActivating,
  isLocking,
}: AcademicYearCardProps) {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');

  const status = year.isLocked
    ? tSettings('academicYearStatusLocked')
    : year.isActive
      ? tSettings('academicYearStatusActive')
      : tSettings('academicYearStatusInactive');
  const statusColor = year.isLocked ? colors.warning : year.isActive ? colors.success : colors.info;
  const activateDisabled = year.isLocked || year.isActive;
  const lockDisabled = year.isLocked || !year.isActive;
  const rolloverCompleted = Boolean(year.rollover);
  const rolloverDisabled = year.isLocked || !year.isActive || rolloverCompleted;
  const rolloverNotes = rolloverSummaryLines(year);

  return (
    <Card withBorder p="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Text fw={600}>{year.name}</Text>
          <Text c="dimmed" size="sm">
            {year.startDate} → {year.endDate}
          </Text>
        </Stack>

        <Badge variant="light" color={statusColor}>
          {status}
        </Badge>
      </Group>

      <Group justify="flex-end" mt="md">
        {onRollover && (
          <Button
            id={`academic-year-card-${year.id}-rollover`}
            variant="light"
            disabled={rolloverDisabled}
            onClick={() => onRollover(year)}
          >
            Rollover
          </Button>
        )}
        <Button
          id={`academic-year-card-${year.id}-activate`}
          variant="light"
          disabled={activateDisabled}
          loading={!activateDisabled && isActivating}
          onClick={() => onActivate(year.id)}
        >
          {tSettings('academicYearActivateButton')}
        </Button>
        <Button
          id={`academic-year-card-${year.id}-lock`}
          variant="light"
          disabled={lockDisabled}
          loading={!lockDisabled && isLocking}
          onClick={() => onLock(year)}
        >
          {tSettings('academicYearLockButton')}
        </Button>
      </Group>

      {rolloverNotes.length > 0 ? (
        <Stack gap={4} mt="sm">
          <Text size="xs" fw={600} c="dimmed">
            Rollover complete
          </Text>
          <List size="xs" c="dimmed" listStyleType="disc" styles={{ item: { lineHeight: 1.35 } }}>
            {rolloverNotes.map((line, idx) => (
              <List.Item key={`${year.id}-rollover-${idx}`}>{line}</List.Item>
            ))}
          </List>
        </Stack>
      ) : null}
    </Card>
  );
}


