'use client';

import { Modal, Stack, Group, Text, Badge } from '@mantine/core';
import { useTranslations, useLocale } from 'next-intl';
import type { TimetableSlot } from '@/types/timetable';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

const formatTime = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours || '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes || '00'} ${ampm}`;
};

function weekdayLabel(dayOfWeek: number, locale: string): string {
  const date = new Date(2024, 0, 7 + dayOfWeek);
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
}

export function SlotDetailsReadOnlyModal({
  opened,
  onClose,
  slot,
}: {
  opened: boolean;
  onClose: () => void;
  slot: TimetableSlot | null;
}) {
  const t = useTranslations('timetable');
  const locale = useLocale();
  const colors = useThemeColors();

  return (
    <Modal opened={opened} onClose={onClose} title={t('slotDetailsTitle')} size="md">
      {slot && (
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2} style={{ flex: 1 }}>
              <Text size="lg" fw={600} lineClamp={1}>
                {slot.subjectName || t('freePeriod')}
              </Text>
              <Text size="sm" c="dimmed">
                {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
              </Text>
            </Stack>

            {slot.periodNumber ? (
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {t('period')} {slot.periodNumber}
              </Text>
            ) : null}
          </Group>

          <Group justify="space-between" align="center" wrap="nowrap">
            <Badge
              size="lg"
              variant="light"
              color={
                slot.slotType === 'class'
                  ? colors.primary
                  : slot.slotType === 'assembly'
                    ? 'orange'
                    : slot.slotType === 'break'
                      ? 'yellow'
                      : 'gray'
              }
            >
              {t(`slotType_${slot.slotType}` as 'slotType_class' | 'slotType_assembly' | 'slotType_break')}
            </Badge>
          </Group>

          {slot.staffName ? (
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                {t('teacher')}
              </Text>
              <Text size="sm" fw={500}>
                {slot.staffName}
              </Text>
            </div>
          ) : null}

          {slot.room ? (
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                {t('room')}
              </Text>
              <Text size="sm" fw={500}>
                {slot.room}
              </Text>
            </div>
          ) : null}

          <div>
            <Text size="xs" c="dimmed" mb={4}>
              {t('day')}
            </Text>
            <Text size="sm" fw={500}>
              {weekdayLabel(slot.dayOfWeek, locale)}
            </Text>
          </div>

          {slot.className && slot.sectionName ? (
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                {t('class')}
              </Text>
              <Text size="sm" fw={500}>
                {slot.className} - {slot.sectionName}
              </Text>
            </div>
          ) : null}
        </Stack>
      )}
    </Modal>
  );
}
