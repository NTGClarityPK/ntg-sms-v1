'use client';

import { Box, Card, Text, Group, Badge, Stack, ActionIcon, Image } from '@mantine/core';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { StockMatrix } from './StockMatrix';
import type { UniformItem, StockEntry } from '@/types/inventory';

interface UniformItemCardProps {
  item: UniformItem;
  onEdit?: (item: UniformItem) => void;
  onDelete?: (item: UniformItem) => void;
  onAddStock?: (item: UniformItem) => void;
  onEditStockQuantity?: (item: UniformItem, entry: StockEntry) => void;
  canEdit?: boolean;
}

export function UniformItemCard({
  item,
  onEdit,
  onDelete,
  onAddStock,
  onEditStockQuantity,
  canEdit,
}: UniformItemCardProps) {
  const t = useTranslations('inventory');
  const CATEGORY_LABELS: Record<string, string> = {
    shirt: t('shirt'),
    pants: t('pants'),
    skirt: t('skirt'),
    shoes: t('shoes'),
    accessories: t('accessories'),
  };
  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;
  const stock = item.stock ?? [];
  const remainingQty = stock.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
  const imageSrc = item.imageUrl && item.imageUrl.trim().length > 0 ? item.imageUrl : '/inventoryitems.jpg';

  return (
    <Card shadow="sm" padding="md" withBorder>
      <Stack gap="sm">
        {canEdit && (
          <Text size="sm" fw={500} c="dimmed">
            {t('remaining')}: {remainingQty}
          </Text>
        )}
        <Box h={120} style={{ overflow: 'hidden' }}>
          <Image
            src={imageSrc}
            alt={item.name}
            h={120}
            w="100%"
            fit="cover"
            radius="sm"
          />
        </Box>
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text fw={600} lineClamp={1}>
              {item.name}
            </Text>
            <Group gap="xs">
              <Badge size="sm" variant="light">
                {categoryLabel}
              </Badge>
              {item.gender && (
                <Badge size="sm" variant="outline">
                  {item.gender}
                </Badge>
              )}
            </Group>
          </div>
          {canEdit && (
            <Group gap="xs">
              <ActionIcon
                variant="light"
                size="sm"
                onClick={() => onAddStock?.(item)}
                title={t('addStock')}
              >
                <IconPlus size={16} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                size="sm"
                onClick={() => onEdit?.(item)}
                title={t('editItem')}
              >
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                size="sm"
                color="red"
                onClick={() => onDelete?.(item)}
                title={t('deleteItem')}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          )}
        </Group>
        {item.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {item.description}
          </Text>
        )}
        <StockMatrix
          stock={stock}
          onEditQuantity={
            onEditStockQuantity
              ? (entry) => onEditStockQuantity(item, entry)
              : undefined
          }
        />
      </Stack>
    </Card>
  );
}
