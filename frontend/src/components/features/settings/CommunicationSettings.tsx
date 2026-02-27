'use client';

import { Alert, Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

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
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const settingQuery = useSystemSetting<CommunicationDirectionValue>('communication_direction');
  const updateMutation = useUpdateSystemSetting<CommunicationDirectionValue>('communication_direction');

  const [value, setValue] = useState<CommunicationDirectionValue | null>(null);

  useEffect(() => {
    const remote = settingQuery.data?.data?.value;
    const nextValue: CommunicationDirectionValue =
      remote && typeof remote === 'object'
        ? {
            teacher_student: remote.teacher_student ?? DEFAULT_VALUE.teacher_student,
            teacher_parent: remote.teacher_parent ?? DEFAULT_VALUE.teacher_parent,
          }
        : DEFAULT_VALUE;

    setValue((prev) => {
      if (!prev) return nextValue;
      const isSame =
        prev.teacher_student === nextValue.teacher_student &&
        prev.teacher_parent === nextValue.teacher_parent;
      return isSame ? prev : nextValue;
    });
  }, [settingQuery.data?.data?.value]);

  const onSave = async () => {
    if (!value) return;
    try {
      await updateMutation.mutateAsync(value);
      notifications.show({ title: tCommon('success'), message: tSettings('commSaved'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('commLoadError')}>
        <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
      </Alert>
    );
  }

  if (!value) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" py="md">
          <Text size="sm" c="dimmed">{tSettings('commLoading')}</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>{tSettings('commMessagingDirection')}</Text>

        <Stack gap="sm">
          <Text fw={500}>{tSettings('commTeacherStudent')}</Text>
          <Group gap="md" wrap="wrap">
            <Checkbox
              id="communication-settings-teacher-student-both"
              label={tSettings('commBothWays')}
              checked={value.teacher_student === 'both'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_student: 'both',
                }))
              }
            />
            <Checkbox
              id="communication-settings-teacher-student-teacher-only"
              label={tSettings('commTeacherOnly')}
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
          <Text fw={500}>{tSettings('commTeacherParent')}</Text>
          <Group gap="md" wrap="wrap">
            <Checkbox
              id="communication-settings-teacher-parent-both"
              label={tSettings('commBothWays')}
              checked={value.teacher_parent === 'both'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_parent: 'both',
                }))
              }
            />
            <Checkbox
              id="communication-settings-teacher-parent-teacher-only"
              label={tSettings('commTeacherOnly')}
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
          <Button id="communication-settings-save" variant="light" onClick={onSave} loading={updateMutation.isPending || settingQuery.isLoading}>
            {tCommon('save')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
