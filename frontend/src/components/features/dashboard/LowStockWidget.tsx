'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useLowStock } from '@/hooks/useInventory';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSubscriptionFeatures } from '@/hooks/api/useSubscription';

export function LowStockWidget() {
  const colors = useThemeColors();
  const { data: features, isLoading: featuresLoading } = useSubscriptionFeatures();
  const hasInventory = features?.hasInventoryManagement === true;
  const { data: items = [], isLoading, error } = useLowStock(hasInventory);

  if (featuresLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={20} width="70%" />
        <Skeleton height={40} />
      </Stack>
    );
  }

  if (!hasInventory) {
    return null;
  }

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load inventory'}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={20} width="70%" />
        <Skeleton height={40} />
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No low-stock items
        </Text>
      ) : (
        <>
          <Text size="sm" fw={500} c={colors.warning}>
            <IconAlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {items.length} item{items.length !== 1 ? 's' : ''} below threshold
          </Text>
          {items.slice(0, 3).map((item) => {
            const totalQty = item.stock?.reduce((s, e) => s + (e?.quantity ?? 0), 0) ?? 0;
            return (
              <Text key={item.id} size="xs" c="dimmed">
                {item.name} – {totalQty} left
              </Text>
            );
          })}
        </>
      )}
    </Stack>
  );
}
