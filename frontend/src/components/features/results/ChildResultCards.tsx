'use client';

import { useEffect, useState } from 'react';
import { Button, Group, SegmentedControl, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { IconFileDownload } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useResultCardsByStudent, useResultReportSettings } from '@/hooks/useResults';
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

export function ChildResultCards({ studentId }: { studentId: string }) {
  const t = useTranslations('results');
  const { data: cards, isLoading } = useResultCardsByStudent(studentId, { publishedOnly: true });
  const settingsQuery = useResultReportSettings(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadPdfVariant, setDownloadPdfVariant] = useState<'minimal' | 'modern'>('modern');
  const [pdfVariantHydrated, setPdfVariantHydrated] = useState(false);

  useEffect(() => {
    if (pdfVariantHydrated) return;
    const v = settingsQuery.data?.pdfVariant;
    if (v === 'minimal' || v === 'modern') {
      setDownloadPdfVariant(v);
      setPdfVariantHydrated(true);
    }
  }, [pdfVariantHydrated, settingsQuery.data?.pdfVariant]);

  const phaseLabel = (card: ResultCard): string => {
    const phase = card.termPhase ?? card.resultType;
    if (phase === 'interim') return t('resultTypeInterim');
    if (phase === 'mid_term') return t('resultTypeMidTerm');
    if (phase === 'final') return t('resultTypeFinal');
    return phase;
  };

  const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  };

  const lineLabel = (card: ResultCard): string => {
    const date = formatDate(card.generatedAt);
    if (card.reportKind === 'annual_report') return t('childCardMetaAnnual', { date });
    if (card.reportKind === 'progress_report') {
      return t('childCardMetaProgress', { seq: card.progressSequence ?? 0, date });
    }
    return t('childCardMetaTerm', { phase: phaseLabel(card), date });
  };

  const handleDownload = async (card: ResultCard) => {
    setDownloadingId(card.id);
    try {
      const params = new URLSearchParams();
      params.set('classSectionId', card.classSectionId);
      params.set('academicYearId', card.academicYearId);
      params.set('resultType', card.termPhase ?? card.resultType);
      if (card.reportKind && card.reportKind !== 'term_report') {
        params.set('reportKind', card.reportKind);
      }
      params.set('pdfVariant', downloadPdfVariant);
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/student/${studentId}/result-card/pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `result-card-${studentId}.pdf`);
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
        {t('childNoCards')}
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t('childPublishedTitle')}
      </Text>
      <Stack gap={4}>
        <Text size="xs" fw={500}>
          {t('downloadPdfVariantLabel')}
        </Text>
        <Text size="xs" c="dimmed">
          {t('childDownloadPdfVariantHint')}
        </Text>
        <Tooltip label={t('tooltipPdfLayoutChoice')} withArrow position="top">
          <div>
            <SegmentedControl
              id="child-results-pdf-layout"
              value={downloadPdfVariant}
              onChange={(v) => setDownloadPdfVariant(v as 'minimal' | 'modern')}
              data={[
                { value: 'minimal', label: t('pdfVariantMinimal') },
                { value: 'modern', label: t('pdfVariantModern') },
              ]}
            />
          </div>
        </Tooltip>
      </Stack>
      {cards.map((card) => (
        <Group key={card.id} justify="space-between" wrap="nowrap">
          <Text size="sm">{lineLabel(card)}</Text>
          <Tooltip label={t('tooltipChildDownload')} withArrow>
            <span style={{ display: 'inline-block' }}>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconFileDownload size={14} />}
                loading={downloadingId === card.id}
                onClick={() => void handleDownload(card)}
              >
                {t('childDownload')}
              </Button>
            </span>
          </Tooltip>
        </Group>
      ))}
    </Stack>
  );
}
