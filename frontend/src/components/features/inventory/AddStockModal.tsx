'use client';

import { Modal, TextInput, NumberInput, Button, Stack, Group, Select } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAddOrUpdateStock } from '@/hooks/useInventory';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import type { UniformItem, StockEntry, InventorySizeEntry } from '@/types/inventory';

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
  const t = useTranslations('inventory');
  const addStockSchema = useMemo(
    () =>
      z.object({
        size: z.string().min(1, t('sizeRequired')),
        quantity: z.number().min(0, t('quantityMin')),
        lowStockThreshold: z.number().min(0).optional(),
      }),
    [t],
  );
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
      title={isEdit ? t('updateStock') : t('addStockTitle')}
    >
      <form id="add-stock-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {sizeOptions.length > 0 ? (
            <Select
              id="add-stock-size"
              label={t('size')}
              placeholder={t('selectSize')}
              data={sizeOptions}
              {...form.getInputProps('size')}
              disabled={isEdit}
            />
          ) : (
            <TextInput
              id="add-stock-size-text"
              label={t('size')}
              placeholder={t('sizePlaceholder')}
              {...form.getInputProps('size')}
              disabled={isEdit}
            />
          )}
          <NumberInput
            id="add-stock-quantity"
            label={t('quantity')}
            min={0}
            {...form.getInputProps('quantity')}
          />
          <NumberInput
            id="add-stock-low-threshold"
            label={t('lowStockThreshold')}
            min={0}
            description={t('lowStockThresholdDescription')}
            {...form.getInputProps('lowStockThreshold')}
          />
          <Group justify="flex-end" mt="md">
            <Button id="add-stock-cancel" variant="default" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              id="add-stock-submit"
              type="submit"
              loading={addStockMutation.isPending}
            >
              {isEdit ? t('updateStock') : t('add')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
