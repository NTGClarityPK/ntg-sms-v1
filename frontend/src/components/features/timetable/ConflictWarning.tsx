'use client';

import { Alert, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { Conflict } from '@/types/timetable';

interface ConflictWarningProps {
  conflict: Conflict;
}

function formatHm(time: string): string {
  return time.split(':').slice(0, 2).join(':');
}

export function ConflictWarning({ conflict }: ConflictWarningProps) {
  const t = useTranslations('timetable');
  const typeLabel = t(
    `conflictType_${conflict.type}` as
      | 'conflictType_teacher_double_booking'
      | 'conflictType_invalid_school_day'
      | 'conflictType_class_section_slot_overlap'
      | 'conflictType_timing_mismatch',
    { defaultValue: conflict.type },
  );

  return (
    <Alert icon={<IconAlertTriangle size={16} />} color="red" title={typeLabel}>
      <Stack gap="xs">
        <Text size="sm">{conflict.message}</Text>
        {conflict.subjectTemplateName && (
          <Text size="xs" c="dimmed" fw={500}>
            {conflict.subjectTemplateName}
          </Text>
        )}
        {conflict.conflictingSlots.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={500}>
              {t('conflictingSlots')}
            </Text>
            {conflict.conflictingSlots.map((slot) => (
              <Text key={slot.id} size="xs" c="dimmed">
                • {slot.slotLabel ?? t('unknown')}: {[slot.className, slot.sectionName].filter(Boolean).join(' ')} (
                {formatHm(slot.startTime)} – {formatHm(slot.endTime)})
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Alert>
  );
}





