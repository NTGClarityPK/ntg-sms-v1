'use client';

import { Alert, Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { useEffect, useState } from 'react';

type Direction = 'both' | 'teacher_only';

interface CommunicationDirectionValue {
  teacher_student: Direction;
  teacher_parent: Direction;
}

const DEFAULT_VALUE: CommunicationDirectionValue = {
  teacher_student: 'both',
  teacher_parent: 'both',
};

export function CommunicationSettings() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const settingQuery = useSystemSetting<CommunicationDirectionValue>('communication_direction');
  const updateMutation = useUpdateSystemSetting<CommunicationDirectionValue>('communication_direction');

  const [value, setValue] = useState<CommunicationDirectionValue | null>(null);

  useEffect(() => {
    const remote = settingQuery.data?.data?.value;
    if (remote && typeof remote === 'object') {
      setValue({
        teacher_student: remote.teacher_student ?? DEFAULT_VALUE.teacher_student,
        teacher_parent: remote.teacher_parent ?? DEFAULT_VALUE.teacher_parent,
      });
    } else if (!remote && !value) {
      // No remote value yet – initialize with defaults once
      setValue(DEFAULT_VALUE);
    }
  }, [settingQuery.data?.data?.value, value]);

  const onSave = async () => {
    if (!value) return;
    try {
      await updateMutation.mutateAsync(value);
      notifications.show({ title: 'Success', message: 'Communication settings saved', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load settings">
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  if (!value) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" py="md">
          <Text size="sm" c="dimmed">Loading communication settings...</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>Messaging direction</Text>

        <Stack gap="sm">
          <Text fw={500}>Teacher ↔ Student</Text>
          <Group gap="md" wrap="wrap">
            <Checkbox
              label="Both directions"
              checked={value.teacher_student === 'both'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_student: 'both',
                }))
              }
            />
            <Checkbox
              label="Teacher can send only"
              checked={value.teacher_student === 'teacher_only'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_student: 'teacher_only',
                }))
              }
            />
          </Group>
        </Stack>

        <Stack gap="sm">
          <Text fw={500}>Teacher ↔ Parent</Text>
          <Group gap="md" wrap="wrap">
            <Checkbox
              label="Both directions"
              checked={value.teacher_parent === 'both'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_parent: 'both',
                }))
              }
            />
            <Checkbox
              label="Teacher can send only"
              checked={value.teacher_parent === 'teacher_only'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_parent: 'teacher_only',
                }))
              }
            />
          </Group>
        </Stack>

        <Group justify="flex-end">
          <Button variant="light" onClick={onSave} loading={updateMutation.isPending || settingQuery.isLoading}>
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}


