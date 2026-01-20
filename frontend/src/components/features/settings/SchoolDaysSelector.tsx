'use client';

import { Button, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';

const days: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface SchoolDaysSelectorProps {
  initialActiveDays: number[];
  isSaving: boolean;
  onSave: (activeDays: number[]) => Promise<void>;
}

export function SchoolDaysSelector({ initialActiveDays, isSaving, onSave }: SchoolDaysSelectorProps) {
  const notifyColors = useNotificationColors();
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected(initialActiveDays);
  }, [initialActiveDays]);

  const items = useMemo(
    () =>
      days.map((d) => ({
        value: String(d.value),
        label: d.label,
      })),
    [],
  );

  const value = selected.map(String);

  const handleSave = async () => {
    try {
      await onSave(selected);
      notifications.show({ title: 'Success', message: 'School days updated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>School days</Text>
        <Checkbox.Group
          value={value}
          onChange={(values) => setSelected(values.map((v) => Number(v)).filter((n) => Number.isFinite(n)))}
        >
          <Group gap="md" wrap="wrap">
            {items.map((i) => (
              <Checkbox key={i.value} value={i.value} label={i.label} />
            ))}
          </Group>
        </Checkbox.Group>

        <Group justify="flex-end">
          <Button variant="light" onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}


