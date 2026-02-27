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
import { useTranslations } from 'next-intl';

const SOURCE_CHIPS = ['all', 'library', 'assessment', 'uniform'] as const;
type SourceChip = typeof SOURCE_CHIPS[number];

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
  const t = useTranslations('storage');
  const source =
    sourceChip === 'all' ? undefined : (sourceChip as 'library' | 'assessment' | 'uniform');
  const { data: files, isLoading, error } = useStorageFiles({ limit: 50, source });
  const deleteFile = useDeleteStorageFile();

  const getSourceLabel = (c: SourceChip): string => {
    const map: Record<SourceChip, string> = {
      all: t('sourceAll'),
      library: t('sourceLibrary'),
      assessment: t('sourceAssessment'),
      uniform: t('sourceUniform'),
    };
    return map[c];
  };

  if (isLoading || !files) {
    return (
      <Paper p="md" withBorder>
        <Skeleton height={200} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title={t('largestFilesLoadError')}>
        {error instanceof Error ? error.message : t('largestFilesLoadError')}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={500}>{t('sourceFilterLabel')}</Text>
          <Chip.Group
            value={sourceChip}
            onChange={(v) => onSourceChipChange(Array.isArray(v) ? v[0] ?? 'all' : v ?? 'all')}
          >
            <Group gap="xs">
              {SOURCE_CHIPS.map((c) => (
                <Chip key={c} value={c} variant="filled">
                  {getSourceLabel(c)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">{t('largestFilesTitle')}</Text>
        {files.length === 0 ? (
          <Text size="sm" c="dimmed">{t('largestFilesNoData')}</Text>
        ) : (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('largestFilesColName')}</Table.Th>
                <Table.Th>{t('largestFilesColSource')}</Table.Th>
                <Table.Th>{t('largestFilesColSize')}</Table.Th>
                <Table.Th>{t('largestFilesColActions')}</Table.Th>
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
                            if (confirm(t('deleteFileConfirm'))) {
                              deleteFile.mutate({ id: f.id, source: f.source });
                            }
                          }}
                        >
                          {t('deleteFileMenuItem')}
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
