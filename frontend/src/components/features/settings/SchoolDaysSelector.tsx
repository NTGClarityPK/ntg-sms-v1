'use client';

import { Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';

interface SchoolDaysSelectorProps {
  initialActiveDays: number[];
  isSaving: boolean;
  onSave: (activeDays: number[]) => Promise<void>;
}

export function SchoolDaysSelector({ initialActiveDays, isSaving, onSave }: SchoolDaysSelectorProps) {
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected(initialActiveDays);
  }, [initialActiveDays]);

  const items = useMemo(
    () => [
      { value: '0', label: tSettings('scheduleSchoolDaySunday') },
      { value: '1', label: tSettings('scheduleSchoolDayMonday') },
      { value: '2', label: tSettings('scheduleSchoolDayTuesday') },
      { value: '3', label: tSettings('scheduleSchoolDayWednesday') },
      { value: '4', label: tSettings('scheduleSchoolDayThursday') },
      { value: '5', label: tSettings('scheduleSchoolDayFriday') },
      { value: '6', label: tSettings('scheduleSchoolDaySaturday') },
    ],
    [tSettings],
  );

  const value = selected.map(String);

  const handleSave = async () => {
    try {
      await onSave(selected);
      notifications.show({ title: tCommon('success'), message: tSettings('scheduleSchoolDaySaved'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>{tSettings('scheduleSchoolDaysTitle')}</Text>
        <Checkbox.Group
          id="school-days-group"
          value={value}
          onChange={(values) => setSelected(values.map((v) => Number(v)).filter((n) => Number.isFinite(n)))}
        >
          <Group gap="md" wrap="wrap">
            {items.map((i) => (
              <Checkbox key={i.value} id={`school-days-day-${i.value}`} value={i.value} label={i.label} />
            ))}
          </Group>
        </Checkbox.Group>

        <Group justify="flex-end">
          <Button id="school-days-save" variant="light" onClick={handleSave} loading={isSaving}>
            {tCommon('save')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
