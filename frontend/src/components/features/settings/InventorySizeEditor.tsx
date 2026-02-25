'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import type { InventorySizeEntry } from '@/types/inventory';

function dimensionsToEntries(d: Record<string, string>): { name: string; value: string }[] {
  return Object.entries(d).map(([name, value]) => ({ name, value }));
}

function entriesToDimensions(entries: { name: string; value: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value } of entries) {
    const k = name.trim();
    if (k) out[k] = value.trim();
  }
  return out;
}

export function InventorySizeEditor() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const settingQuery = useSystemSetting<InventorySizeEntry[]>('inventory_sizes');
  const updateMutation = useUpdateSystemSetting<InventorySizeEntry[]>('inventory_sizes');

  const [items, setItems] = useState<InventorySizeEntry[]>([]);
  const [dimensionRows, setDimensionRows] = useState<Record<number, { name: string; value: string }[]>>({});

  useEffect(() => {
    if (Array.isArray(settingQuery.data?.data?.value)) {
      setItems(settingQuery.data.data.value);
      const rows: Record<number, { name: string; value: string }[]> = {};
      settingQuery.data.data.value.forEach((entry, i) => {
        rows[i] = dimensionsToEntries(entry.dimensions ?? {});
      });
      setDimensionRows(rows);
    }
  }, [settingQuery.data?.data?.value]);

  const addSize = () => {
    const newIndex = items.length;
    setItems((prev) => [...prev, { size: '', dimensions: {} }]);
    setDimensionRows((prev) => ({ ...prev, [newIndex]: [] }));
  };

  const removeSize = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDimensionRows((prev) => {
      const next: Record<number, { name: string; value: string }[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < index) next[i] = v;
        if (i > index) next[i - 1] = v;
      });
      return next;
    });
  };

  const setSizeCode = (index: number, size: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], size };
      return next;
    });
  };

  const setDimensionRowsFor = (index: number, rows: { name: string; value: string }[]) => {
    setDimensionRows((prev) => ({ ...prev, [index]: rows }));
  };

  const addDimensionRow = (index: number) => {
    setDimensionRows((prev) => ({
      ...prev,
      [index]: [...(prev[index] ?? []), { name: '', value: '' }],
    }));
  };

  const setDimensionEntry = (
    sizeIndex: number,
    dimIndex: number,
    field: 'name' | 'value',
    value: string,
  ) => {
    setDimensionRows((prev) => {
      const list = [...(prev[sizeIndex] ?? [])];
      list[dimIndex] = { ...list[dimIndex], [field]: value };
      return { ...prev, [sizeIndex]: list };
    });
  };

  const removeDimensionRow = (sizeIndex: number, dimIndex: number) => {
    setDimensionRows((prev) => {
      const list = (prev[sizeIndex] ?? []).filter((_, i) => i !== dimIndex);
      return { ...prev, [sizeIndex]: list };
    });
  };

  const normalizedItems = useMemo(() => {
    return items.map((entry, i) => ({
      size: entry.size.trim(),
      dimensions: entriesToDimensions(dimensionRows[i] ?? []),
    }));
  }, [items, dimensionRows]);

  const onSave = async () => {
    const toSave = normalizedItems.filter((e) => e.size.length > 0);
    try {
      await updateMutation.mutateAsync(toSave);
      notifications.show({
        title: 'Success',
        message: 'Inventory sizes saved',
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load sizes">
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>Sizes and dimensions</Text>
        <Text size="sm" c="dimmed">
          Define size codes (e.g. S, M, L) and optional dimensions (e.g. chest, length) used when adding stock and processing requests.
        </Text>

        {items.length === 0 ? (
          <Text c="dimmed" size="sm">
            No sizes yet. Add sizes to use in Inventory stock and requests.
          </Text>
        ) : (
          <Stack gap="lg">
            {items.map((entry, index) => (
              <Paper key={index} withBorder p="sm" style={{ borderColor: 'var(--mantine-color-default-border)' }}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <TextInput
                      placeholder="Size (e.g. S, M, L)"
                      value={entry.size}
                      onChange={(e) => setSizeCode(index, e.currentTarget.value)}
                      size="sm"
                      style={{ minWidth: 120 }}
                    />
                    <ActionIcon
                      variant="light"
                      color={colors.error}
                      onClick={() => removeSize(index)}
                      aria-label="Remove size"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">
                      Dimensions (e.g. chest, length, waist)
                    </Text>
                    {(dimensionRows[index] ?? []).map((dim, dimIndex) => (
                      <Group key={dimIndex} gap="xs">
                        <TextInput
                          placeholder="Name"
                          value={dim.name}
                          onChange={(e) => setDimensionEntry(index, dimIndex, 'name', e.currentTarget.value)}
                          size="xs"
                          style={{ minWidth: 100 }}
                        />
                        <TextInput
                          placeholder="Value"
                          value={dim.value}
                          onChange={(e) => setDimensionEntry(index, dimIndex, 'value', e.currentTarget.value)}
                          size="xs"
                          style={{ minWidth: 80 }}
                        />
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color={colors.error}
                          onClick={() => removeDimensionRow(index, dimIndex)}
                          aria-label="Remove dimension"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => addDimensionRow(index)}
                    >
                      Add dimension
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Group>
          <Button id="inventory-size-editor-add" variant="light" size="sm" leftSection={<IconPlus size={16} />} onClick={addSize}>
            Add size
          </Button>
        </Group>

        <Group justify="flex-end">
          <Button
            id="inventory-size-editor-save"
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
