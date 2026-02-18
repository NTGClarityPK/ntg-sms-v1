'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';

export function InventoryCategoryEditor() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const settingQuery = useSystemSetting<string[]>('inventory_categories');
  const updateMutation = useUpdateSystemSetting<string[]>('inventory_categories');

  const [input, setInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (Array.isArray(settingQuery.data?.data?.value)) {
      setItems(settingQuery.data.data.value);
    }
  }, [settingQuery.data?.data?.value]);

  const normalizedItems = useMemo(
    () => items.map((s) => s.trim()).filter((s) => s.length > 0),
    [items],
  );

  const addItem = () => {
    const next = input.trim();
    if (!next) return;
    if (normalizedItems.includes(next)) {
      notifications.show({
        title: 'Error',
        message: 'Category already exists',
        color: notifyColors.error,
      });
      return;
    }
    setItems([...normalizedItems, next]);
    setInput('');
  };

  const startEdit = (index: number, currentValue: string) => {
    setEditingIndex(index);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      notifications.show({
        title: 'Error',
        message: 'Category name cannot be empty',
        color: notifyColors.error,
      });
      return;
    }
    const updated = [...normalizedItems];
    if (
      updated.some((item, idx) => item === trimmedValue && idx !== editingIndex)
    ) {
      notifications.show({
        title: 'Error',
        message: 'Category already exists',
        color: notifyColors.error,
      });
      return;
    }
    updated[editingIndex] = trimmedValue;
    setItems(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const removeItem = (name: string) => {
    if (window.confirm(`Delete category "${name}"?`)) {
      setItems(normalizedItems.filter((x) => x !== name));
    }
  };

  const onSave = async () => {
    try {
      await updateMutation.mutateAsync(normalizedItems);
      notifications.show({
        title: 'Success',
        message: 'Inventory categories saved',
        color: notifyColors.success,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
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
        <Text fw={600}>Uniform categories</Text>
        <Text size="sm" c="dimmed">
          Categories used when creating uniform items (e.g. Shirt, Pants, Skirt).
        </Text>

        <Group align="flex-end">
          <TextInput
            label="Add category"
            placeholder="e.g. Shirt"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          <Button variant="light" onClick={addItem}>
            Add
          </Button>
        </Group>

        {normalizedItems.length === 0 ? (
          <Text c="dimmed" size="sm">
            No categories yet. Add some to use in Inventory.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {normalizedItems.map((name, index) => (
                <Table.Tr key={`${name}-${index}`}>
                  <Table.Td>
                    {editingIndex === index ? (
                      <TextInput
                        value={editValue}
                        onChange={(e) => setEditValue(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        size="sm"
                      />
                    ) : (
                      <Text size="sm">{name}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {editingIndex === index ? (
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color={colors.success}
                          onClick={saveEdit}
                          aria-label="Save"
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color={colors.error}
                          onClick={cancelEdit}
                          aria-label="Cancel"
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color={colors.primary}
                          onClick={() => startEdit(index, name)}
                          aria-label="Edit category"
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color={colors.error}
                          onClick={() => removeItem(name)}
                          aria-label="Delete category"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        <Group justify="flex-end">
          <Button
            variant="light"
            onClick={onSave}
            loading={updateMutation.isPending || settingQuery.isLoading}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
