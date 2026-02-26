'use client';

import { Alert, Text, Group, Button, Badge } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { UniformItem } from '@/types/inventory';

interface LowStockAlertProps {
  items: UniformItem[];
  isLoading?: boolean;
}

export function LowStockAlert({ items, isLoading }: LowStockAlertProps) {
  const t = useTranslations('inventory');
  const router = useRouter();

  if (isLoading || !items || items.length === 0) return null;

  const totalLow = items.reduce(
    (acc, item) =>
      acc +
      (item.stock?.filter((s) => s.quantity <= (s.lowStockThreshold ?? 10)).length ??
        0),
    0,
  );

  if (totalLow === 0) return null;

  return (
    <Alert
      icon={<IconAlertTriangle size={16} />}
      title={
        <Group gap="xs">
          <span>{t('lowStock')}</span>
          <Badge color="red" variant="filled" size="sm">
            {t('lowStock')}
          </Badge>
        </Group>
      }
      color="red"
      variant="light"
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">
          {t('lowStockMessage', { count: items.length })}
        </Text>
        <Button
          variant="light"
          color="red"
          size="xs"
          onClick={() => router.push('/inventory/items')}
        >
          {t('manageStock')}
        </Button>
      </Group>
    </Alert>
  );
}
