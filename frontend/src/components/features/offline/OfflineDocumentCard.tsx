'use client';

import { Card, Group, Text, Button, Badge } from '@mantine/core';
import { IconFile, IconTrash, IconExternalLink } from '@tabler/icons-react';
import type { OfflineDocumentItem } from '@/lib/offline/db';

interface OfflineDocumentCardProps {
  item: OfflineDocumentItem;
  onOpen: (item: OfflineDocumentItem) => void;
  onDelete: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(type: string): string {
  switch (type) {
    case 'report_pdf':
      return 'Report PDF';
    case 'report_excel':
      return 'Report Excel';
    case 'library_item':
      return 'Library';
    default:
      return type;
  }
}

export function OfflineDocumentCard({ item, onOpen, onDelete }: OfflineDocumentCardProps) {
  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconFile size={24} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <Text fw={500} size="sm" lineClamp={1}>
              {item.title}
            </Text>
            <Group gap="xs" mt={4}>
              <Badge variant="light" size="sm">
                {typeLabel(item.type)}
              </Badge>
              <Text size="xs" c="dimmed">
                {formatSize(item.size)} · {new Date(item.savedAt).toLocaleDateString()}
              </Text>
            </Group>
          </div>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconExternalLink size={14} />}
            onClick={() => onOpen(item)}
          >
            Open
          </Button>
          <Button
            variant="subtle"
            size="xs"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={() => onDelete(item.id)}
          >
            Delete
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
