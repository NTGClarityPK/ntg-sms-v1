'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Group,
  Title,
  Stack,
  Paper,
  Text,
  Skeleton,
  Tabs,
  Chip,
  ScrollArea,
} from '@mantine/core';
import { IconFolderOff, IconDatabase } from '@tabler/icons-react';
import { listOfflineDocuments, deleteOfflineDocument } from '@/lib/offline/documents';
import type { OfflineDocumentItem } from '@/lib/offline/db';
import { OfflineDocumentCard } from '@/components/features/offline/OfflineDocumentCard';
import { StorageManager } from '@/components/features/offline/StorageManager';

const TYPE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'report_pdf', label: 'Report PDF' },
  { value: 'report_excel', label: 'Report Excel' },
  { value: 'library_item', label: 'Library' },
];

export default function OfflineDocumentsPage() {
  const [documents, setDocuments] = useState<OfflineDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listOfflineDocuments(typeFilter || undefined);
      setDocuments(list);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const handler = () => loadDocuments();
    window.addEventListener('offline-documents-updated', handler);
    return () => window.removeEventListener('offline-documents-updated', handler);
  }, [loadDocuments]);

  const handleOpen = (item: OfflineDocumentItem) => {
    const url = URL.createObjectURL(item.blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDelete = async (id: string) => {
    await deleteOfflineDocument(id);
    await loadDocuments();
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Offline documents</Title>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Tabs defaultValue="documents">
          <Tabs.List>
            <Tabs.Tab value="documents" leftSection={<IconFolderOff size={16} />}>
              Documents
            </Tabs.Tab>
            <Tabs.Tab value="storage" leftSection={<IconDatabase size={16} />}>
              Storage
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="documents" pt="md">
            <Paper p="sm" withBorder mb="md">
              <Chip.Group value={typeFilter} onChange={(v) => setTypeFilter(Array.isArray(v) ? v[0] ?? '' : v ?? '')}>
                <Group gap="xs" wrap="wrap">
                  {TYPE_CHIPS.map((chip) => (
                    <Chip key={chip.value || 'all'} value={chip.value} variant="filled">
                      {chip.label}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
            </Paper>

            {loading ? (
              <Stack gap="md">
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </Stack>
            ) : documents.length === 0 ? (
              <Paper withBorder p="xl">
                <Stack align="center" gap="sm">
                  <IconFolderOff size={48} style={{ opacity: 0.3 }} />
                  <Text c="dimmed">No offline documents</Text>
                  <Text size="sm" c="dimmed" ta="center">
                    Use &quot;Save for offline&quot; on reports or library items to access them without internet.
                  </Text>
                </Stack>
              </Paper>
            ) : (
              <ScrollArea>
                <Stack gap="sm">
                  {documents.map((doc) => (
                    <OfflineDocumentCard
                      key={doc.id}
                      item={doc}
                      onOpen={handleOpen}
                      onDelete={handleDelete}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="storage" pt="md">
            <StorageManager />
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
