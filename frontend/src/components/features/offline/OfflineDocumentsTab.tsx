'use client';

import { useState, useEffect, useCallback } from 'react';
import { Stack, Paper, Text, Skeleton, Chip, Group, ScrollArea } from '@mantine/core';
import { IconFolderOff } from '@tabler/icons-react';
import { listOfflineDocuments, deleteOfflineDocument } from '@/lib/offline/documents';
import type { OfflineDocumentItem } from '@/lib/offline/db';
import { OfflineDocumentCard } from '@/components/features/offline/OfflineDocumentCard';
import { useTranslations } from 'next-intl';

const TYPE_CHIPS = [
  { value: '', labelKey: 'offlineDocuments.filterAll' as const },
  { value: 'report_pdf', labelKey: 'offlineDocuments.filterReportPdf' as const },
  { value: 'report_excel', labelKey: 'offlineDocuments.filterReportExcel' as const },
  { value: 'library_item', labelKey: 'offlineDocuments.filterLibrary' as const },
];

export function OfflineDocumentsTab() {
  const t = useTranslations('storage');
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
      <Paper p="sm" withBorder mb="md">
        <Chip.Group
          value={typeFilter}
          onChange={(v) => setTypeFilter(Array.isArray(v) ? v[0] ?? '' : v ?? '')}
        >
          <Group gap="xs" wrap="wrap">
            {TYPE_CHIPS.map((chip) => (
              <Chip key={chip.value || 'all'} value={chip.value} variant="filled">
                {t(chip.labelKey)}
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
            <Text c="dimmed">{t('offlineDocuments.emptyTitle')}</Text>
            <Text size="sm" c="dimmed" ta="center">
              {t('offlineDocuments.emptyHint')}
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
    </>
  );
}
