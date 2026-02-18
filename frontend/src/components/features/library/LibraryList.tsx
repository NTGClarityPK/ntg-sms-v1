'use client';

import { Table, Pagination, Group, Text, Badge, ActionIcon, Image } from '@mantine/core';
import { IconDownload, IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useDownloadLibraryItem, useDeleteLibraryItem, useIncrementLibraryViewCount } from '@/hooks/useLibrary';
import { modals } from '@mantine/modals';
import { UploadModal } from './UploadModal';
import { useState } from 'react';

/** Default book thumbnail when none provided (in public folder) */
const DEFAULT_BOOK_THUMBNAIL = '/book.png';

interface LibraryListProps {
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

export function LibraryList({ items, meta, onPageChange, canEdit = false }: LibraryListProps) {
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
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Thumbnail</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Author</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Views</Table.Th>
            <Table.Th>Downloads</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Image
                  src={item.thumbnailUrl || DEFAULT_BOOK_THUMBNAIL}
                  width={60}
                  height={60}
                  fit="cover"
                  radius="sm"
                />
              </Table.Td>
              <Table.Td>
                <Text fw={500}>{item.title}</Text>
                {item.description && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.description}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm">{item.author || '-'}</Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light">
                  {item.category}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{item.viewCount}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{item.downloadCount}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
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
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

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
