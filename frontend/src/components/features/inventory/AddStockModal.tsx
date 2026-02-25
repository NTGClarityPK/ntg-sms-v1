'use client';

import { Modal, TextInput, NumberInput, Button, Stack, Group, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useEffect, useMemo } from 'react';
import { useAddOrUpdateStock } from '@/hooks/useInventory';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import type { UniformItem, StockEntry, InventorySizeEntry } from '@/types/inventory';

const addStockSchema = z.object({
  size: z.string().min(1, 'Size is required'),
  quantity: z.number().min(0, 'Quantity must be 0 or more'),
  lowStockThreshold: z.number().min(0).optional(),
});

interface AddStockModalProps {
  opened: boolean;
  onClose: () => void;
  item: UniformItem | null;
  editEntry?: StockEntry | null;
}

export function AddStockModal({
  opened,
  onClose,
  item,
  editEntry,
}: AddStockModalProps) {
  const addStockMutation = useAddOrUpdateStock();
  const isEdit = !!editEntry;
  const sizesSetting = useSystemSetting<InventorySizeEntry[]>('inventory_sizes');
  const sizeOptions = useMemo(() => {
    const raw = sizesSetting.data?.data?.value;
    if (Array.isArray(raw)) {
      return raw.map((s) => ({ value: s.size?.trim() ?? '', label: s.size?.trim() ?? '' })).filter((o) => o.value);
    }
    return [];
  }, [sizesSetting.data?.data?.value]);

  const form = useForm({
    initialValues: {
      size: '',
      quantity: 0,
      lowStockThreshold: 10,
    },
    validate: zodResolver(addStockSchema),
  });

  useEffect(() => {
    if (opened) {
      if (editEntry) {
        form.setValues({
          size: editEntry.size,
          quantity: editEntry.quantity,
          lowStockThreshold: editEntry.lowStockThreshold ?? 10,
        });
      } else if (item) {
        form.setValues({
          size: '',
          quantity: 0,
          lowStockThreshold: 10,
        });
      }
    }
  }, [opened, item, editEntry]);

  const handleSubmit = (values: typeof form.values) => {
    if (!item) return;
    addStockMutation.mutate(
      {
        itemId: item.id,
        input: {
          size: values.size,
          quantity: values.quantity,
          lowStockThreshold: values.lowStockThreshold,
        },
      },
      {
        onSuccess: () => {
          form.reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Update stock' : 'Add stock'}
    >
      <form id="add-stock-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {sizeOptions.length > 0 ? (
            <Select
              id="add-stock-size"
              label="Size"
              placeholder="Select size"
              data={sizeOptions}
              {...form.getInputProps('size')}
              disabled={isEdit}
            />
          ) : (
            <TextInput
              id="add-stock-size-text"
              label="Size"
              placeholder="e.g. S, M, L or 8, 10, 12"
              {...form.getInputProps('size')}
              disabled={isEdit}
            />
          )}
          <NumberInput
            id="add-stock-quantity"
            label="Quantity"
            min={0}
            {...form.getInputProps('quantity')}
          />
          <NumberInput
            id="add-stock-low-threshold"
            label="Low stock threshold"
            min={0}
            description="Alert when quantity falls at or below this"
            {...form.getInputProps('lowStockThreshold')}
          />
          <Group justify="flex-end" mt="md">
            <Button id="add-stock-cancel" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              id="add-stock-submit"
              type="submit"
              loading={addStockMutation.isPending}
            >
              {isEdit ? 'Update' : 'Add'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
