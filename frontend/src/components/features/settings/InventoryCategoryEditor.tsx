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
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';

export function InventoryCategoryEditor() {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');
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
        title: tCommon('error'),
        message: t('categoryAlreadyExists'),
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
        title: tCommon('error'),
        message: t('categoryNameEmpty'),
        color: notifyColors.error,
      });
      return;
    }
    const updated = [...normalizedItems];
    if (
      updated.some((item, idx) => item === trimmedValue && idx !== editingIndex)
    ) {
      notifications.show({
        title: tCommon('error'),
        message: t('categoryAlreadyExists'),
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
    if (window.confirm(t('deleteCategoryConfirm', { name }))) {
      setItems(normalizedItems.filter((x) => x !== name));
    }
  };

  const onSave = async () => {
    try {
      await updateMutation.mutateAsync(normalizedItems);
      notifications.show({
        title: tCommon('success'),
        message: t('inventoryCategoriesSaved'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({
        title: tCommon('error'),
        message,
        color: notifyColors.error,
      });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title={t('failedToLoadCategories')}>
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>{t('uniformCategories')}</Text>
        <Text size="sm" c="dimmed">
          {t('uniformCategoriesDescription')}
        </Text>

        <Group align="flex-end">
          <TextInput
            id="inventory-category-editor-input"
            label={t('addCategory')}
            placeholder={t('addCategoryPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
          />
          <Button id="inventory-category-editor-add" variant="light" onClick={addItem}>
            {t('add')}
          </Button>
        </Group>

        {normalizedItems.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('noCategoriesYet')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('categoryColumn')}</Table.Th>
                <Table.Th w={100}>{t('actions')}</Table.Th>
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
            id="inventory-category-editor-save"
            variant="light"
            onClick={onSave}
            loading={updateMutation.isPending || settingQuery.isLoading}
          >
            {t('save')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
