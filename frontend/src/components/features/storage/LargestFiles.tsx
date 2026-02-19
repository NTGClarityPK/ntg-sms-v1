'use client';

import {
  Paper,
  Table,
  Text,
  Group,
  Chip,
  Stack,
  Skeleton,
  Alert,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useStorageFiles, useDeleteStorageFile } from '@/hooks/useStorage';

const SOURCE_CHIPS = ['all', 'library', 'assessment', 'uniform'] as const;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

interface LargestFilesProps {
  sourceChip: string;
  onSourceChipChange: (v: string) => void;
}

export function LargestFiles({ sourceChip, onSourceChipChange }: LargestFilesProps) {
  const source =
    sourceChip === 'all' ? undefined : (sourceChip as 'library' | 'assessment' | 'uniform');
  const { data: files, isLoading, error } = useStorageFiles({ limit: 50, source });
  const deleteFile = useDeleteStorageFile();

  if (isLoading || !files) {
    return (
      <Paper p="md" withBorder>
        <Skeleton height={200} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error">
        {error instanceof Error ? error.message : 'Failed to load files'}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={500}>
            Source:
          </Text>
          <Chip.Group
            value={sourceChip}
            onChange={(v) => onSourceChipChange(Array.isArray(v) ? v[0] ?? 'all' : v ?? 'all')}
          >
            <Group gap="xs">
              {SOURCE_CHIPS.map((c) => (
                <Chip key={c} value={c} variant="filled">
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">
          Largest files
        </Text>
        {files.length === 0 ? (
          <Text size="sm" c="dimmed">
            No files found.
          </Text>
        ) : (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File name</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {files.map((f) => (
                <Table.Tr key={`${f.source}-${f.id}`}>
                  <Table.Td>
                    <Text size="sm" lineClamp={1} title={f.fileName}>
                      {f.fileName}
                    </Text>
                  </Table.Td>
                  <Table.Td>{f.source}</Table.Td>
                  <Table.Td>{formatBytes(f.fileSizeBytes)}</Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={160}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="red" size="sm">
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => {
                            if (confirm('Delete this file? This cannot be undone.')) {
                              deleteFile.mutate({ id: f.id, source: f.source });
                            }
                          }}
                        >
                          Delete file
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
