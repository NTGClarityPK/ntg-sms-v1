'use client';

import { Group, Badge, Text, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { StockEntry } from '@/types/inventory';

interface StockMatrixProps {
  stock: StockEntry[];
  lowStockThreshold?: number;
  onEditQuantity?: (entry: StockEntry) => void;
}

export function StockMatrix({
  stock,
  lowStockThreshold = 10,
  onEditQuantity,
}: StockMatrixProps) {
  const t = useTranslations('inventory');
  if (!stock || stock.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('noSizesDefined')}
      </Text>
    );
  }

  const sorted = [...stock].sort((a, b) => a.size.localeCompare(b.size));

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        {sorted.map((entry) => {
          const isOutOfStock = entry.quantity <= 0;
          const isLow =
            !isOutOfStock &&
            entry.quantity <= (entry.lowStockThreshold ?? lowStockThreshold);
          const badgeColor = isOutOfStock ? 'red' : isLow ? 'red' : 'gray';
          const badgeVariant = isOutOfStock || isLow ? 'filled' : 'light';
          const label = isOutOfStock
            ? `${entry.size}: ${t('outOfStock')}`
            : t('sizeQuantity', { size: entry.size, quantity: entry.quantity });
          return (
            <Badge
              key={entry.id}
              variant={badgeVariant}
              color={badgeColor}
              size="lg"
              style={{ cursor: onEditQuantity ? 'pointer' : undefined }}
              onClick={() => onEditQuantity?.(entry)}
            >
              {label}
            </Badge>
          );
        })}
      </Group>
    </Stack>
  );
}
