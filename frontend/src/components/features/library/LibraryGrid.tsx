'use client';

import { SimpleGrid, Pagination, Group, Text, Badge, Card, Image, Stack, ActionIcon } from '@mantine/core';
import { IconDownload, IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useDownloadLibraryItem, useDeleteLibraryItem, useIncrementLibraryViewCount } from '@/hooks/useLibrary';
import { modals } from '@mantine/modals';
import { UploadModal } from './UploadModal';
import { useState } from 'react';

/** Default book thumbnail when none provided (in public folder) */
const DEFAULT_BOOK_THUMBNAIL = '/book.png';

interface LibraryGridProps {
  items: Array<{
    id: string;
    title: string;
    author?: string;
    description?: string;
    category: string;
    fileUrl: string;
    fileName: string;
    thumbnailUrl?: string;
    viewCount: number;
    downloadCount: number;
  }>;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  canEdit?: boolean;
}

export function LibraryGrid({ items, meta, onPageChange, canEdit = false }: LibraryGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const downloadMutation = useDownloadLibraryItem();
  const deleteMutation = useDeleteLibraryItem();
  const viewMutation = useIncrementLibraryViewCount();

  const handleView = async (id: string) => {
    await viewMutation.mutateAsync(id);
    window.open(items.find((item) => item.id === id)?.fileUrl, '_blank');
  };

  const handleDownload = async (id: string) => {
    const url = await downloadMutation.mutateAsync(id);
    // Open in new tab to avoid losing current page
    window.open(url, '_blank');
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    open();
  };

  const handleDelete = (id: string, title: string) => {
    modals.openConfirmModal({
      title: 'Delete Library Item',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{title}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {items.map((item) => (
          <Card key={item.id} shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section>
              <Image
                src={item.thumbnailUrl || DEFAULT_BOOK_THUMBNAIL}
                height={200}
                alt={item.title}
                fit="cover"
              />
            </Card.Section>

            <Stack gap="xs" mt="md">
              <Text fw={500} lineClamp={2}>
                {item.title}
              </Text>
              {item.author && (
                <Text size="sm" c="dimmed">
                  by {item.author}
                </Text>
              )}
              <Badge size="sm" variant="light">
                {item.category}
              </Badge>
              {item.description && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {item.description}
                </Text>
              )}
              <Group justify="space-between" mt="xs">
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    <IconEye size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {item.viewCount}
                  </Text>
                  <Text size="xs" c="dimmed">
                    <IconDownload size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                    {item.downloadCount}
                  </Text>
                </Group>
                <Group gap="xs">
                  <ActionIcon variant="light" size="sm" onClick={() => handleView(item.id)}>
                    <IconEye size={16} />
                  </ActionIcon>
                  <ActionIcon variant="light" size="sm" onClick={() => handleDownload(item.id)}>
                    <IconDownload size={16} />
                  </ActionIcon>
                  {canEdit && (
                    <>
                      <ActionIcon variant="light" size="sm" onClick={() => handleEdit(item.id)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(item.id, item.title)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </>
                  )}
                </Group>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {meta && meta.totalPages > 1 && (
        <Group justify="center" mt="xl">
          <Pagination value={meta.page} onChange={onPageChange} total={meta.totalPages} />
        </Group>
      )}

      {canEdit && editingId && (
        <UploadModal opened={opened} onClose={() => { close(); setEditingId(null); }} itemId={editingId} />
      )}
    </>
  );
}
