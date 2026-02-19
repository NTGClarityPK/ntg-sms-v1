'use client';

import { useState, useEffect } from 'react';
import { Paper, Text, Button, Group, Skeleton } from '@mantine/core';
import { getOfflineDocumentsTotalSize, deleteOfflineDocumentsOlderThan } from '@/lib/offline/documents';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageManager() {
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const loadTotal = async () => {
    const total = await getOfflineDocumentsTotalSize();
    setTotalBytes(total);
  };

  useEffect(() => {
    loadTotal();
  }, []);

  const handleClearOld = async () => {
    setClearing(true);
    try {
      const deleted = await deleteOfflineDocumentsOlderThan(THIRTY_DAYS_MS);
      await loadTotal();
      if (deleted > 0) {
        window.dispatchEvent(new Event('offline-documents-updated'));
      }
    } finally {
      setClearing(false);
    }
  };

  if (totalBytes === null) {
    return <Skeleton height={80} />;
  }

  return (
    <Paper withBorder p="md">
      <Group justify="space-between">
        <div>
          <Text fw={500} size="sm">
            Offline storage used
          </Text>
          <Text size="lg" fw={600}>
            {formatSize(totalBytes)}
          </Text>
        </div>
        <Button
          variant="light"
          size="sm"
          onClick={handleClearOld}
          loading={clearing}
          disabled={totalBytes === 0}
        >
          Clear documents older than 30 days
        </Button>
      </Group>
    </Paper>
  );
}
