'use client';

import { Alert, Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';

export function LibraryCategoryEditor() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const settingQuery = useSystemSetting<string[]>('library_categories');
  const updateMutation = useUpdateSystemSetting<string[]>('library_categories');

  const [input, setInput] = useState('');
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (Array.isArray(settingQuery.data?.data?.value)) setItems(settingQuery.data.data.value);
  }, [settingQuery.data?.data?.value]);

  const normalizedItems = useMemo(() => items.map((s) => s.trim()).filter((s) => s.length > 0), [items]);

  const addItem = () => {
    const next = input.trim();
    if (!next) return;
    if (normalizedItems.includes(next)) return;
    setItems([...normalizedItems, next]);
    setInput('');
  };

  const removeItem = (name: string) => {
    setItems(normalizedItems.filter((x) => x !== name));
  };

  const onSave = async () => {
    try {
      await updateMutation.mutateAsync(normalizedItems);
      notifications.show({ title: 'Success', message: 'Library categories saved', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load categories">
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>Library categories</Text>

        <Group align="flex-end">
          <TextInput
            label="Add category"
            placeholder="Textbooks"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          <Button variant="light" onClick={addItem}>
            Add
          </Button>
        </Group>

        <Stack gap="xs">
          {normalizedItems.length === 0 ? (
            <Text c="dimmed" size="sm">
              No categories yet.
            </Text>
          ) : (
            normalizedItems.map((name) => (
              <Group key={name} justify="space-between">
                <Text size="sm">{name}</Text>
                <Button variant="light" onClick={() => removeItem(name)}>
                  Remove
                </Button>
              </Group>
            ))
          )}
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


