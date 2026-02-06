'use client';

import { Alert, Group, Text, Stack, Badge } from '@mantine/core';
import { IconClock, IconCalendar, IconInfoCircle } from '@tabler/icons-react';
import type { TimingTemplateInfo } from '@/types/timetable';

interface TemplateInfoBannerProps {
  templateInfo: TimingTemplateInfo | null;
}

export function TemplateInfoBanner({ templateInfo }: TemplateInfoBannerProps) {
  if (!templateInfo) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="No Timing Template">
        <Text size="sm">
          No timing template is assigned to this class. Please assign one in Settings to ensure
          proper time validation.
        </Text>
      </Alert>
    );
  }

  const formatTime = (time: string) => {
    // Convert HH:MM:SS to HH:MM AM/PM
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours || '0', 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Alert
      icon={<IconCalendar size={16} />}
      color="blue"
      title={`Timing Template: ${templateInfo.templateName}`}
    >
      <Stack gap="xs" mt="xs">
        <Group gap="md">
          <Group gap={4}>
            <IconClock size={14} />
            <Text size="sm" fw={500}>
              School Hours:
            </Text>
            <Text size="sm">
              {formatTime(templateInfo.startTime)} - {formatTime(templateInfo.endTime)}
            </Text>
          </Group>
          <Group gap={4}>
            <Text size="sm" fw={500}>
              Period Duration:
            </Text>
            <Text size="sm">{templateInfo.periodDurationMinutes} minutes</Text>
          </Group>
        </Group>

        {templateInfo.slots.length > 0 && (
          <Group gap="xs" mt={4}>
            <Text size="sm" fw={500}>
              Template Slots:
            </Text>
            {templateInfo.slots.map((slot, index) => (
              <Badge key={index} variant="light" size="sm">
                {slot.name}
                {slot.startTime && slot.endTime && (
                  <span style={{ marginLeft: 4 }}>
                    ({formatTime(slot.startTime)} - {formatTime(slot.endTime)})
                  </span>
                )}
              </Badge>
            ))}
          </Group>
        )}

        <Text size="xs" c="dimmed" mt={4}>
          ⚠️ All periods must be within {formatTime(templateInfo.startTime)} -{' '}
          {formatTime(templateInfo.endTime)}
        </Text>
      </Stack>
    </Alert>
  );
}



