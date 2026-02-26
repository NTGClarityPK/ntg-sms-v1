'use client';

import { Table, Pagination, Group, Text, Badge, ActionIcon, Image, Modal, Stack } from '@mantine/core';
import { IconDownload, IconEye, IconEdit, IconTrash, IconFolderOff } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { useDownloadLibraryItem, useDeleteLibraryItem, useIncrementLibraryViewCount } from '@/hooks/useLibrary';
import { saveDocumentForOffline } from '@/lib/offline/documents';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
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
  const t = useTranslations('library');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ fileUrl: string; fileName: string } | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const downloadMutation = useDownloadLibraryItem();
  const deleteMutation = useDeleteLibraryItem();
  const viewMutation = useIncrementLibraryViewCount();

  const handleView = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await viewMutation.mutateAsync(id);
    setPreviewItem({ fileUrl: item.fileUrl, fileName: item.fileName });
  };

  const isPdf = (fileName: string) => /\.pdf$/i.test(fileName);

  const handleDownload = async (id: string) => {
    const url = await downloadMutation.mutateAsync(id);
    window.open(url, '_blank');
  };

  const handleSaveForOffline = async (id: string) => {
    const libraryItem = items.find((i) => i.id === id);
    if (!libraryItem) return;
    try {
      const url = await downloadMutation.mutateAsync(id);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch file');
      const blob = await res.blob();
      await saveDocumentForOffline(libraryItem.title, 'library_item', url, blob);
      notifications.show({ title: t('savedForOffline'), message: t('openFromOffline'), color: 'green' });
    } catch (e) {
      notifications.show({
        title: t('failedToSave'),
        message: e instanceof Error ? e.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    open();
  };

  const handleDelete = (id: string, title: string) => {
    modals.openConfirmModal({
      title: t('deleteItem'),
      children: (
        <Text size="sm">
          {t('deleteConfirm', { title })}
        </Text>
      ),
      labels: { confirm: t('delete'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('thumbnail')}</Table.Th>
            <Table.Th>{t('tableTitle')}</Table.Th>
            <Table.Th>{t('author')}</Table.Th>
            <Table.Th>{t('category')}</Table.Th>
            {canEdit && <Table.Th>{t('views')}</Table.Th>}
            {canEdit && <Table.Th>{t('downloads')}</Table.Th>}
            <Table.Th style={{ textAlign: 'right' }}>{t('actions')}</Table.Th>
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
              {canEdit && (
                <Table.Td>
                  <Text size="sm">{item.viewCount}</Text>
                </Table.Td>
              )}
              {canEdit && (
                <Table.Td>
                  <Text size="sm">{item.downloadCount}</Text>
                </Table.Td>
              )}
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <ActionIcon variant="light" size="sm" onClick={() => handleView(item.id)} title={t('view')}>
                    <IconEye size={16} />
                  </ActionIcon>
                  <ActionIcon variant="light" size="sm" onClick={() => handleDownload(item.id)} title={t('download')}>
                    <IconDownload size={16} />
                  </ActionIcon>
                  <ActionIcon variant="light" size="sm" onClick={() => handleSaveForOffline(item.id)} title={t('saveForOffline')}>
                    <IconFolderOff size={16} />
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

      <Modal
        opened={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.fileName ?? t('preview')}
        size="xl"
        centered
      >
        {previewItem && (isPdf(previewItem.fileName) ? (
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                {t('pdfPreviewHint')}
              </Text>
              <iframe
                src={previewItem.fileUrl}
                title={previewItem.fileName}
                style={{
                  width: '100%',
                  minHeight: '70vh',
                  border: '1px solid var(--mantine-color-gray-3)',
                  borderRadius: '8px',
                }}
              />
            </Stack>
          ) : (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {t('previewNotAvailable')}
              </Text>
              <Group justify="flex-end">
                <ActionIcon
                  variant="light"
                  size="lg"
                  onClick={() => window.open(previewItem.fileUrl, '_blank')}
                >
                  <IconDownload size={18} />
                </ActionIcon>
              </Group>
            </Stack>
          ))}
      </Modal>
    </>
  );
}
