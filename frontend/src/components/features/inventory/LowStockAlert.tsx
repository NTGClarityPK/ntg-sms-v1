'use client';

import { Alert, Text, Group, Button, Badge } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import type { UniformItem } from '@/types/inventory';

interface LowStockAlertProps {
  items: UniformItem[];
  isLoading?: boolean;
}

export function LowStockAlert({ items, isLoading }: LowStockAlertProps) {
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
          <span>Low stock</span>
          <Badge color="red" variant="filled" size="sm">
            Low stock
          </Badge>
        </Group>
      }
      color="red"
      variant="light"
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">
          {items.length} item(s) have sizes at or below the low-stock threshold.
          Replenish stock to avoid running out.
        </Text>
        <Button
          variant="light"
          color="red"
          size="xs"
          onClick={() => router.push('/inventory/items')}
        >
          Manage stock
        </Button>
      </Group>
    </Alert>
  );
}
