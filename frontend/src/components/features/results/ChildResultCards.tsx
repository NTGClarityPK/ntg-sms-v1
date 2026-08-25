'use client';

import { useEffect, useMemo, useState } from 'react';
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

type DownloadKey = string;

export function ChildResultCards({ studentId }: { studentId: string }) {
  const t = useTranslations('results');
  const { data: cards, isLoading } = useResultCardsByStudent(studentId, { publishedOnly: true });
  const settingsQuery = useResultReportSettings(true);
  const [downloadingKey, setDownloadingKey] = useState<DownloadKey | null>(null);
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

  const termAndAnnualCards = useMemo(
    () => (cards ?? []).filter((c) => c.reportKind !== 'progress_report'),
    [cards],
  );

  const progressPacks = useMemo(() => {
    const byMonth = new Map<number, ResultCard>();
    for (const card of cards ?? []) {
      if (card.reportKind !== 'progress_report') continue;
      const month = card.progressSequence;
      if (month == null || month < 1 || month > 12) continue;
      const existing = byMonth.get(month);
      if (!existing || (card.generatedAt ?? '') > (existing.generatedAt ?? '')) {
        byMonth.set(month, card);
      }
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([month, card]) => ({ month, card }));
  }, [cards]);

  const downloadAcademic = async (card: ResultCard) => {
    setDownloadingKey(`academic-${card.id}`);
    try {
      const params = new URLSearchParams();
      params.set('classSectionId', card.classSectionId);
      params.set('academicYearId', card.academicYearId);
      params.set('resultType', card.termPhase ?? card.resultType);
      if (card.reportKind && card.reportKind !== 'term_report') {
        params.set('reportKind', card.reportKind);
      }
      if (
        card.reportKind === 'progress_report' &&
        card.progressSequence != null &&
        card.progressSequence >= 1 &&
        card.progressSequence <= 12
      ) {
        params.set('progressMonth', String(card.progressSequence));
      }
      params.set('pdfVariant', downloadPdfVariant);
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/student/${studentId}/result-card/pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `result-card-${studentId}.pdf`);
    } catch {
      // Error handled by api client
    } finally {
      setDownloadingKey(null);
    }
  };

  const downloadPackPdf = async (
    kind: 'attendance' | 'behaviour',
    card: ResultCard,
    month: number,
  ) => {
    setDownloadingKey(`${kind}-${card.id}`);
    try {
      const params = new URLSearchParams();
      params.set('month', String(month));
      params.set('academicYearId', card.academicYearId);
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/student/${studentId}/monthly-pack/${kind}/pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `${kind}-${month}-${studentId}.pdf`);
    } catch {
      // Error handled by api client
    } finally {
      setDownloadingKey(null);
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
    <Stack gap="sm">
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

      {progressPacks.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('childMonthlyPackTitle')}
          </Text>
          <Text size="xs" c="dimmed">
            {t('childMonthlyPackHint')}
          </Text>
          {progressPacks.map(({ month, card }) => (
            <Stack key={`pack-${month}-${card.id}`} gap={6}>
              <Text size="sm">
                {t('childCardMetaProgressMonth', {
                  month: t(`month${month}` as 'month1'),
                  date: formatDate(card.generatedAt),
                })}
              </Text>
              <Group gap="xs" wrap="wrap">
                <Tooltip label={t('tooltipChildDownloadAcademic')} withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconFileDownload size={14} />}
                    loading={downloadingKey === `academic-${card.id}`}
                    disabled={!!downloadingKey && downloadingKey !== `academic-${card.id}`}
                    onClick={() => void downloadAcademic(card)}
                  >
                    {t('childPackAcademic')}
                  </Button>
                </Tooltip>
                <Tooltip label={t('tooltipChildDownloadAttendance')} withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconFileDownload size={14} />}
                    loading={downloadingKey === `attendance-${card.id}`}
                    disabled={!!downloadingKey && downloadingKey !== `attendance-${card.id}`}
                    onClick={() => void downloadPackPdf('attendance', card, month)}
                  >
                    {t('childPackAttendance')}
                  </Button>
                </Tooltip>
                <Tooltip label={t('tooltipChildDownloadBehaviour')} withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconFileDownload size={14} />}
                    loading={downloadingKey === `behaviour-${card.id}`}
                    disabled={!!downloadingKey && downloadingKey !== `behaviour-${card.id}`}
                    onClick={() => void downloadPackPdf('behaviour', card, month)}
                  >
                    {t('childPackBehaviour')}
                  </Button>
                </Tooltip>
              </Group>
            </Stack>
          ))}
        </Stack>
      )}

      {termAndAnnualCards.length > 0 && (
        <Stack gap="xs">
          {progressPacks.length > 0 && (
            <Text size="sm" fw={500}>
              {t('childTermCardsTitle')}
            </Text>
          )}
          {termAndAnnualCards.map((card) => {
            const date = formatDate(card.generatedAt);
            const label =
              card.reportKind === 'annual_report'
                ? t('childCardMetaAnnual', { date })
                : t('childCardMetaTerm', { phase: phaseLabel(card), date });
            return (
              <Group key={card.id} justify="space-between" wrap="nowrap">
                <Text size="sm">{label}</Text>
                <Tooltip label={t('tooltipChildDownload')} withArrow>
                  <span style={{ display: 'inline-block' }}>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconFileDownload size={14} />}
                      loading={downloadingKey === `academic-${card.id}`}
                      disabled={!!downloadingKey && downloadingKey !== `academic-${card.id}`}
                      onClick={() => void downloadAcademic(card)}
                    >
                      {t('childDownload')}
                    </Button>
                  </span>
                </Tooltip>
              </Group>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
