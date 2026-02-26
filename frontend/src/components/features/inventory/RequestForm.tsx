'use client';

import { useState } from 'react';
import {
  Select,
  Button,
  Stack,
  Group,
  Text,
  NumberInput,
  Textarea,
  Paper,
  ActionIcon,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useUniforms } from '@/hooks/useInventory';
import { useCreateUniformRequest } from '@/hooks/useUniformRequests';
import type { UniformItem } from '@/types/inventory';
import type { CreateUniformRequestInput } from '@/types/inventory';

interface RequestFormProps {
  studentOptions: { value: string; label: string }[];
  onSuccess?: () => void;
}

interface LineItem {
  uniformItemId: string;
  size: string;
  quantity: number;
  itemName?: string;
}

export function RequestForm({
  studentOptions,
  onSuccess,
}: RequestFormProps) {
  const t = useTranslations('inventory');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const createMutation = useCreateUniformRequest();

  const { data: uniformsResponse } = useUniforms({
    page: 1,
    limit: 200,
  });
  const uniforms = (uniformsResponse as { data?: UniformItem[] })?.data ?? [];

  /** Sizes that have stock (quantity > 0) for the item. */
  const getInStockSizesForItem = (itemId: string): { size: string; quantity: number }[] => {
    const item = uniforms.find((u) => u.id === itemId);
    return (
      item?.stock?.filter((s) => (s.quantity ?? 0) > 0).map((s) => ({ size: s.size, quantity: s.quantity ?? 0 })) ?? []
    );
  };

  const hasAnyStock = (item: UniformItem): boolean =>
    (item.stock?.some((s) => (s.quantity ?? 0) > 0) ?? false);

  const getAvailableQuantity = (itemId: string, size: string): number => {
    const item = uniforms.find((u) => u.id === itemId);
    const entry = item?.stock?.find((s) => s.size === size);
    return entry?.quantity ?? 0;
  };

  const firstInStockItem = uniforms.find(hasAnyStock);
  const addLine = () => {
    if (!firstInStockItem) return;
    const inStockSizes = getInStockSizesForItem(firstInStockItem.id);
    setLines((prev) => [
      ...prev,
      {
        uniformItemId: firstInStockItem.id,
        size: inStockSizes[0]?.size ?? '',
        quantity: 1,
        itemName: firstInStockItem.name,
      },
    ]);
  };

  const updateLine = (index: number, updates: Partial<LineItem>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...updates } : l)),
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!studentId || lines.length === 0) return;
    const validLines = lines.filter(
      (l) =>
        l.uniformItemId &&
        l.size &&
        l.quantity >= 1 &&
        getAvailableQuantity(l.uniformItemId, l.size) >= l.quantity,
    );
    if (validLines.length === 0) return;
    const input: CreateUniformRequestInput = {
      studentId,
      items: validLines.map((l) => ({
        uniformItemId: l.uniformItemId,
        size: l.size,
        quantity: l.quantity,
      })),
      notes: notes.trim() || undefined,
    };
    createMutation.mutate(input, {
      onSuccess: () => {
        setStudentId(null);
        setLines([]);
        setNotes('');
        onSuccess?.();
      },
    });
  };

  const isLineRequestable = (line: LineItem): boolean => {
    if (!line.uniformItemId || !line.size) return false;
    const available = getAvailableQuantity(line.uniformItemId, line.size);
    return available > 0 && line.quantity >= 1 && line.quantity <= available;
  };

  const canSubmit =
    studentId &&
    lines.length > 0 &&
    lines.some(isLineRequestable);

  return (
    <Stack gap="md">
      <Select
        id="uniform-request-student"
        label={t('student')}
        placeholder={t('selectStudent')}
        data={studentOptions}
        value={studentId}
        onChange={setStudentId}
        required
      />
      <Text size="sm" fw={500}>
        {t('itemsLabel')}
      </Text>
      {lines.map((line, index) => {
        const inStockSizes = getInStockSizesForItem(line.uniformItemId);
        const isOutOfStock = line.uniformItemId && inStockSizes.length === 0;
        const available = getAvailableQuantity(line.uniformItemId, line.size);
        const maxQty = Math.max(0, available);

        return (
          <Paper key={index} p="sm" withBorder>
            <Group align="flex-end" gap="xs">
              <Select
                id={`uniform-request-line-${index}-item`}
                label={t('items')}
                placeholder={t('selectItem')}
                data={uniforms.map((u) => ({
                  value: u.id,
                  label: hasAnyStock(u) ? u.name : `${u.name} (${t('outOfStock')})`,
                }))}
                value={line.uniformItemId}
                onChange={(v) => {
                  const item = uniforms.find((u) => u.id === v);
                  const sizes = item ? getInStockSizesForItem(item.id) : [];
                  updateLine(index, {
                    uniformItemId: v ?? '',
                    size: sizes[0]?.size ?? '',
                    itemName: item?.name,
                  });
                }}
                style={{ flex: 1 }}
              />
              {isOutOfStock ? (
                <Text size="sm" c="red" fw={500} style={{ alignSelf: 'center' }}>
                  {t('outOfStockCannotRequest')}
                </Text>
              ) : (
                <Select
                  id={`uniform-request-line-${index}-size`}
                  label={t('size')}
                  placeholder={t('size')}
                  data={inStockSizes.map((s) => ({
                    value: s.size,
                    label: t('sizeInStock', { size: s.size, quantity: s.quantity }),
                  }))}
                  value={line.size}
                  onChange={(v) => updateLine(index, { size: v ?? '' })}
                  style={{ minWidth: 120 }}
                />
              )}
              {!isOutOfStock && (
                <NumberInput
                  id={`uniform-request-line-${index}-qty`}
                  label={t('qtyLabel')}
                  min={1}
                  max={maxQty}
                  value={line.quantity}
                  onChange={(v) =>
                    updateLine(index, {
                      quantity: Math.min(Number(v) || 1, maxQty || 1),
                    })
                  }
                  style={{ width: 70 }}
                />
              )}
              <ActionIcon
                color="red"
                variant="light"
                onClick={() => removeLine(index)}
                title={t('remove')}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        );
      })}
      <Button id="uniform-request-add-item" variant="light" onClick={addLine} disabled={!firstInStockItem}>
        {t('addItemLine')}
      </Button>
      {uniforms.length > 0 && !firstInStockItem && (
        <Text size="sm" c="red" fw={500}>
          {t('allItemsOutOfStock')}
        </Text>
      )}
      <Textarea
        id="uniform-request-notes"
        label={t('notesOptional')}
        placeholder={t('notesPlaceholder')}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Button
        id="uniform-request-submit"
        onClick={handleSubmit}
        disabled={!canSubmit}
        loading={createMutation.isPending}
      >
        {t('submitRequest')}
      </Button>
    </Stack>
  );
}
