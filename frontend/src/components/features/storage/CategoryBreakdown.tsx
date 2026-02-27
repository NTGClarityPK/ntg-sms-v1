'use client';

import { Paper, Table, Text, Group, Chip, Stack, Skeleton, Alert, Button } from '@mantine/core';
import { useStorageBreakdown, useRefreshStorageBreakdown } from '@/hooks/useStorage';
import { IconRefresh } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

const CATEGORY_CHIPS = ['all', 'library', 'images', 'pdfs', 'attachments', 'other'] as const;
type CategoryChip = typeof CATEGORY_CHIPS[number];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

interface CategoryBreakdownProps {
  categoryChip: string;
  onCategoryChipChange: (v: string) => void;
}

export function CategoryBreakdown({ categoryChip, onCategoryChipChange }: CategoryBreakdownProps) {
  const t = useTranslations('storage');
  const { data, isLoading, error } = useStorageBreakdown();
  const refreshMutation = useRefreshStorageBreakdown();

  const getCategoryLabel = (c: CategoryChip): string => {
    const map: Record<CategoryChip, string> = {
      all: t('categoryAll'),
      library: t('categoryLibrary'),
      images: t('categoryImages'),
      pdfs: t('categoryPdfs'),
      attachments: t('categoryAttachments'),
      other: t('categoryOther'),
    };
    return map[c];
  };

  if (isLoading || !data) {
    return (
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={120} />
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title={t('breakdownLoadError')}>
        {error instanceof Error ? error.message : t('breakdownLoadError')}
      </Alert>
    );
  }

  const filtered =
    categoryChip === 'all'
      ? data.categories
      : data.categories.filter((c) => c.category === categoryChip);

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Text size="sm" fw={500}>{t('categoryFilterLabel')}</Text>
              <Chip.Group
                value={categoryChip}
                onChange={(v) => onCategoryChipChange(Array.isArray(v) ? v[0] ?? 'all' : v ?? 'all')}
              >
                <Group gap="xs">
                  {CATEGORY_CHIPS.map((c) => (
                    <Chip key={c} value={c} variant="filled">
                      {getCategoryLabel(c)}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Group>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              loading={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              {t('refreshBreakdownButton')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">{t('usageByCategoryTitle')}</Text>
        {filtered.length === 0 ? (
          <Text size="sm" c="dimmed">{t('breakdownNoData')}</Text>
        ) : (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('breakdownColCategory')}</Table.Th>
                <Table.Th>{t('breakdownColSize')}</Table.Th>
                <Table.Th>{t('breakdownColFileCount')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((c) => (
                <Table.Tr key={c.category}>
                  <Table.Td>{c.category}</Table.Td>
                  <Table.Td>{formatBytes(c.bytesUsed)}</Table.Td>
                  <Table.Td>{c.fileCount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {data.categories.length > 0 && (
          <Text size="sm" c="dimmed" mt="sm">
            {t('breakdownTotal', { size: formatBytes(data.totalBytes), count: data.totalFiles })}
          </Text>
        )}
      </Paper>
    </Stack>
  );
}
