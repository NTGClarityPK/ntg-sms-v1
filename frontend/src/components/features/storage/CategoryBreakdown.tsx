'use client';

import { Paper, Table, Text, Group, Chip, Stack, Skeleton, Alert, Button } from '@mantine/core';
import { useStorageBreakdown, useRefreshStorageBreakdown } from '@/hooks/useStorage';
import { IconRefresh } from '@tabler/icons-react';

const CATEGORY_CHIPS = ['all', 'library', 'images', 'pdfs', 'attachments', 'other'] as const;

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
  const { data, isLoading, error } = useStorageBreakdown();
  const refreshMutation = useRefreshStorageBreakdown();

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
      <Alert color="red" title="Error">
        {error instanceof Error ? error.message : 'Failed to load breakdown'}
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
              <Text size="sm" fw={500}>
                Category:
              </Text>
              <Chip.Group
                value={categoryChip}
                onChange={(v) => onCategoryChipChange(Array.isArray(v) ? v[0] ?? 'all' : v ?? 'all')}
              >
                <Group gap="xs">
                  {CATEGORY_CHIPS.map((c) => (
                    <Chip key={c} value={c} variant="filled">
                      {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
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
              Refresh breakdown
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">
          Usage by category
        </Text>
        {filtered.length === 0 ? (
          <Text size="sm" c="dimmed">
            No data for this category. Click &quot;Refresh breakdown&quot; to recalculate from library and
            attachments.
          </Text>
        ) : (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>File count</Table.Th>
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
            Total: {formatBytes(data.totalBytes)} · {data.totalFiles} files
          </Text>
        )}
      </Paper>
    </Stack>
  );
}
