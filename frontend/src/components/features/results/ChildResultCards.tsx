'use client';

import { useState } from 'react';
import { Button, Group, Skeleton, Stack, Text } from '@mantine/core';
import { IconFileDownload } from '@tabler/icons-react';
import { useResultCardsByStudent } from '@/hooks/useResults';
import { apiClient } from '@/lib/api-client';
import type { ResultCard } from '@/types/results';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resultTypeLabel(resultType: string): string {
  if (resultType === 'interim') return 'Interim';
  if (resultType === 'mid_term') return 'Mid-term';
  if (resultType === 'final') return 'Final';
  return resultType;
}

export function ChildResultCards({ studentId }: { studentId: string }) {
  const { data: cards, isLoading } = useResultCardsByStudent(studentId, { publishedOnly: true });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (card: ResultCard) => {
    setDownloadingId(card.id);
    try {
      const params = new URLSearchParams();
      params.set('classSectionId', card.classSectionId);
      params.set('academicYearId', card.academicYearId);
      params.set('resultType', card.resultType);
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/student/${studentId}/result-card/pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `result-card-${studentId}-${card.resultType}.pdf`);
    } catch {
      // Error handled by api client
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return <Skeleton height={40} radius="sm" />;
  }
  if (!cards?.length) {
    return (
      <Text size="sm" c="dimmed">
        No published result cards yet.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Published result cards
      </Text>
      {cards.map((card) => (
        <Group key={card.id} justify="space-between" wrap="nowrap">
          <Text size="sm">
            {resultTypeLabel(card.resultType)} —{' '}
            {card.generatedAt ? new Date(card.generatedAt).toLocaleDateString() : '—'}
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconFileDownload size={14} />}
            loading={downloadingId === card.id}
            onClick={() => handleDownload(card)}
          >
            Download PDF
          </Button>
        </Group>
      ))}
    </Stack>
  );
}
