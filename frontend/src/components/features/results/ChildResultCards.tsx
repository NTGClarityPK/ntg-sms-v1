'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconCalendarStats,
  IconFileDownload,
  IconMedal,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
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

type DownloadKey = string;

export function ChildResultCards({ studentId }: { studentId: string }) {
  const t = useTranslations('results');
  const { data: cards, isLoading } = useResultCardsByStudent(studentId, { publishedOnly: true });
  const [downloadingKey, setDownloadingKey] = useState<DownloadKey | null>(null);

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

  const defaultTab =
    progressPacks.length > 0 ? 'progress' : termAndAnnualCards.length > 0 ? 'term' : 'progress';

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
      // Layout comes from staff publish snapshot on the server — do not send pdfVariant.
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
    return (
      <Stack gap="sm">
        <Skeleton height={36} radius="sm" />
        <Skeleton height={120} radius="sm" />
      </Stack>
    );
  }
  if (!cards?.length) {
    return (
      <Text size="sm" c="dimmed">
        {t('childNoCards')}
      </Text>
    );
  }

  const busy = !!downloadingKey;

  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {t('childPublishedTitle')}
        </Text>
        <Text size="xs" c="dimmed">
          {t('childDownloadsSchoolLayoutHint')}
        </Text>
      </Stack>

      <Tabs defaultValue={defaultTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab
            value="progress"
            leftSection={<IconCalendarStats size={16} />}
            rightSection={
              progressPacks.length > 0 ? (
                <Badge size="xs" variant="light" circle>
                  {progressPacks.length}
                </Badge>
              ) : undefined
            }
            disabled={progressPacks.length === 0}
          >
            {t('childTabProgress')}
          </Tabs.Tab>
          <Tabs.Tab
            value="term"
            leftSection={<IconMedal size={16} />}
            rightSection={
              termAndAnnualCards.length > 0 ? (
                <Badge size="xs" variant="light" circle>
                  {termAndAnnualCards.length}
                </Badge>
              ) : undefined
            }
            disabled={termAndAnnualCards.length === 0}
          >
            {t('childTabTerm')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="progress" pt="md">
          {progressPacks.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('childNoProgressPacks')}
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={420}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('childColMonth')}</Table.Th>
                    <Table.Th>{t('childColPublished')}</Table.Th>
                    <Table.Th style={{ width: 72 }}>{t('childColDownload')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {progressPacks.map(({ month, card }) => {
                    const monthLabel = t(`month${month}` as 'month1');
                    const academicLoading = downloadingKey === `academic-${card.id}`;
                    const attendanceLoading = downloadingKey === `attendance-${card.id}`;
                    const behaviourLoading = downloadingKey === `behaviour-${card.id}`;
                    const rowBusy = academicLoading || attendanceLoading || behaviourLoading;
                    return (
                      <Table.Tr key={`pack-${month}-${card.id}`}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {monthLabel}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {formatDate(card.generatedAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Menu withinPortal position="bottom-end" shadow="md">
                            <Menu.Target>
                              <Tooltip label={t('childDownloadMenuTooltip')} withArrow>
                                <ActionIcon
                                  id={`child-results-download-menu-${studentId}-${month}`}
                                  variant="light"
                                  size="lg"
                                  loading={rowBusy}
                                  disabled={busy && !rowBusy}
                                  aria-label={t('childDownloadMenuTooltip')}
                                >
                                  <IconFileDownload size={18} />
                                </ActionIcon>
                              </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Label>{t('childMonthlyPackTitle')}</Menu.Label>
                              <Menu.Item
                                leftSection={<IconFileDownload size={14} />}
                                disabled={busy}
                                onClick={() => void downloadAcademic(card)}
                              >
                                {t('childPackAcademic')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconFileDownload size={14} />}
                                disabled={busy}
                                onClick={() => void downloadPackPdf('attendance', card, month)}
                              >
                                {t('childPackAttendance')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconFileDownload size={14} />}
                                disabled={busy}
                                onClick={() => void downloadPackPdf('behaviour', card, month)}
                              >
                                {t('childPackBehaviour')}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="term" pt="md">
          {termAndAnnualCards.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('childNoTermCards')}
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={420}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('childColReport')}</Table.Th>
                    <Table.Th>{t('childColPublished')}</Table.Th>
                    <Table.Th style={{ width: 72 }}>{t('childColDownload')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {termAndAnnualCards.map((card) => {
                    const date = formatDate(card.generatedAt);
                    const label =
                      card.reportKind === 'annual_report'
                        ? t('childReportAnnual')
                        : phaseLabel(card);
                    const key = `academic-${card.id}`;
                    const rowBusy = downloadingKey === key;
                    return (
                      <Table.Tr key={card.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {label}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {date}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label={t('tooltipChildDownload')} withArrow>
                            <ActionIcon
                              id={`child-results-download-term-${card.id}`}
                              variant="light"
                              size="lg"
                              loading={rowBusy}
                              disabled={busy && !rowBusy}
                              aria-label={t('tooltipChildDownload')}
                              onClick={() => void downloadAcademic(card)}
                            >
                              <IconFileDownload size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
