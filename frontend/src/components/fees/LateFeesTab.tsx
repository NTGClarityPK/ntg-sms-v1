'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useEnsureFeeChallanPdf, useLateFees, useWaiveLateFee } from '@/hooks/api/useFees';
import type { LateFeeListItem, LateFeeListStatus } from '@/types/fees';
import { useClassSections } from '@/hooks/useClassSections';

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

function toYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function LateFeesTab() {
  const t = useTranslations('fees');
  const [monthDate, setMonthDate] = useState<Date | null>(null);
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [status, setStatus] = useState<LateFeeListStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [waiveTarget, setWaiveTarget] = useState<LateFeeListItem | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [pdfLoadingChallanId, setPdfLoadingChallanId] = useState<string | null>(null);

  const classSectionsQuery = useClassSections({ page: 1, limit: 500, minimal: true, isActive: true });
  const classSectionOptions = useMemo(() => {
    const list = classSectionsQuery.data?.data ?? [];
    return list.map((cs) => ({
      value: cs.id,
      label: `${cs.classDisplayName ?? cs.className ?? ''}-${cs.sectionName ?? ''}`
        .replace('--', '-')
        .trim(),
    }));
  }, [classSectionsQuery.data?.data]);

  const filters = useMemo(
    () => ({
      month: monthDate ? toYearMonth(monthDate) : undefined,
      classSectionId: classSectionId || undefined,
      status,
      search: search.trim() || undefined,
      page,
      limit: 20,
    }),
    [classSectionId, monthDate, page, search, status],
  );

  const lateFeesQuery = useLateFees(filters);
  const waiveMutation = useWaiveLateFee();
  const ensurePdfMutation = useEnsureFeeChallanPdf({ mode: 'admin' });

  const rows = lateFeesQuery.data?.data ?? [];
  const meta = lateFeesQuery.data?.meta;
  const summary = meta?.summary;
  const totalPages = meta?.totalPages ?? 0;

  const resetPage = () => setPage(1);

  const closeWaive = () => {
    setWaiveTarget(null);
    setWaiveReason('');
  };

  const submitWaive = async () => {
    if (!waiveTarget) return;
    const reason = waiveReason.trim();
    if (!reason) {
      notifications.show({
        title: t('lateFees.waive.reasonRequiredTitle'),
        message: t('lateFees.waive.reasonRequiredMessage'),
        color: 'red',
      });
      return;
    }
    try {
      await waiveMutation.mutateAsync({ id: waiveTarget.id, reason });
      notifications.show({
        title: t('lateFees.waive.successTitle'),
        message: t('lateFees.waive.successMessage'),
        color: 'green',
      });
      closeWaive();
    } catch (e: unknown) {
      notifications.show({
        title: t('lateFees.waive.errorTitle'),
        message: e instanceof Error ? e.message : t('lateFees.waive.errorMessage'),
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      {summary && !summary.lateFeesConfigured ? (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />} title={t('lateFees.notConfiguredTitle')}>
          <Group gap="xs" justify="space-between" wrap="wrap">
            <Text size="sm">{t('lateFees.notConfiguredMessage')}</Text>
            <Button component={Link} href="/settings/fees" size="xs" variant="light" id="fees-late-fees-open-settings">
              {t('lateFees.openSettings')}
            </Button>
          </Group>
        </Alert>
      ) : null}

      <Group gap="sm" wrap="wrap">
        <Badge size="lg" variant="light" color="orange" id="fees-late-fees-chip-active">
          {t('lateFees.chips.active', {
            count: summary?.activeCount ?? 0,
            amount: formatMoney(summary?.activeAmount ?? 0),
          })}
        </Badge>
        <Badge size="lg" variant="light" color="gray" id="fees-late-fees-chip-waived">
          {t('lateFees.chips.waivedThisMonth', {
            count: summary?.waivedThisMonthCount ?? 0,
            amount: formatMoney(summary?.waivedThisMonthAmount ?? 0),
          })}
        </Badge>
      </Group>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <MonthPickerInput
          id="fees-late-fees-filter-month"
          label={t('lateFees.filters.month')}
          placeholder={t('lateFees.filters.monthPlaceholder')}
          value={monthDate}
          onChange={(v) => {
            setMonthDate(v);
            resetPage();
          }}
          clearable
          w={180}
        />
        <Select
          id="fees-late-fees-filter-class"
          label={t('lateFees.filters.class')}
          placeholder={t('lateFees.filters.classPlaceholder')}
          data={classSectionOptions}
          value={classSectionId}
          onChange={(v) => {
            setClassSectionId(v);
            resetPage();
          }}
          searchable
          clearable
          w={220}
        />
        <Select
          id="fees-late-fees-filter-status"
          label={t('lateFees.filters.status')}
          data={[
            { value: 'all', label: t('lateFees.filters.statusAll') },
            { value: 'active', label: t('lateFees.filters.statusActive') },
            { value: 'waived', label: t('lateFees.filters.statusWaived') },
          ]}
          value={status}
          onChange={(v) => {
            setStatus((v as LateFeeListStatus) || 'all');
            resetPage();
          }}
          w={160}
        />
        <TextInput
          id="fees-late-fees-filter-search"
          label={t('lateFees.filters.search')}
          placeholder={t('lateFees.filters.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            resetPage();
          }}
          w={220}
        />
      </Group>

      {lateFeesQuery.isLoading || !lateFeesQuery.data ? (
        <Stack gap="xs">
          <Skeleton height={18} width="40%" />
          <Skeleton height={280} />
        </Stack>
      ) : lateFeesQuery.error ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title={t('lateFees.loadErrorTitle')}>
          {t('lateFees.loadErrorMessage')}
        </Alert>
      ) : rows.length === 0 ? (
        <Text c="dimmed">{t('lateFees.empty')}</Text>
      ) : (
        <Paper withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={960}>
            <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('lateFees.table.student')}</Table.Th>
                  <Table.Th>{t('lateFees.table.class')}</Table.Th>
                  <Table.Th>{t('lateFees.table.month')}</Table.Th>
                  <Table.Th>{t('lateFees.table.dueDate')}</Table.Th>
                  <Table.Th>{t('lateFees.table.daysOverdue')}</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>{t('lateFees.table.amount')}</Table.Th>
                  <Table.Th>{t('lateFees.table.appliedOn')}</Table.Th>
                  <Table.Th>{t('lateFees.table.status')}</Table.Th>
                  <Table.Th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {t('lateFees.table.actions')}
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {row.studentName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.classSectionLabel}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.billingMonth}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(row.dueDate)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {row.daysOverdue != null
                          ? t('lateFees.daysOverdue', { count: row.daysOverdue })
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">{formatMoney(row.lateFeeAmount)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(row.appliedAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={row.waived ? 'gray' : 'orange'}>
                        {row.waived ? t('lateFees.badges.waived') : t('lateFees.badges.active')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <Button
                          id={`fees-late-fees-view-bill-${row.id}`}
                          size="xs"
                          variant="light"
                          leftSection={<IconDownload size={14} />}
                          loading={
                            !!(
                              ensurePdfMutation.isPending &&
                              pdfLoadingChallanId === row.challanId
                            )
                          }
                          disabled={
                            ensurePdfMutation.isPending && pdfLoadingChallanId !== row.challanId
                          }
                          onClick={() => {
                            setPdfLoadingChallanId(row.challanId);
                            ensurePdfMutation.mutate(row.challanId, {
                              onSuccess: (data) => {
                                window.open(
                                  withCacheBust(data.pdfUrl),
                                  '_blank',
                                  'noopener,noreferrer',
                                );
                              },
                              onError: (e: unknown) => {
                                notifications.show({
                                  title: t('lateFees.pdfErrorTitle'),
                                  message:
                                    e instanceof Error ? e.message : t('lateFees.pdfErrorMessage'),
                                  color: 'red',
                                });
                              },
                              onSettled: () => setPdfLoadingChallanId(null),
                            });
                          }}
                        >
                          {t('lateFees.viewBill')}
                        </Button>
                        <Button
                          id={`fees-late-fees-waive-${row.id}`}
                          size="xs"
                          variant="outline"
                          color="orange"
                          disabled={!row.canWaive || waiveMutation.isPending}
                          onClick={() => {
                            setWaiveTarget(row);
                            setWaiveReason('');
                          }}
                        >
                          {t('lateFees.waive.button')}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      {totalPages > 1 ? (
        <Group justify="center">
          <Pagination
            id="fees-late-fees-pagination"
            value={page}
            onChange={setPage}
            total={totalPages}
          />
        </Group>
      ) : null}

      <Modal
        opened={!!waiveTarget}
        onClose={closeWaive}
        title={t('lateFees.waive.title')}
        id="fees-late-fees-waive-modal"
      >
        {waiveTarget ? (
          <Stack gap="sm">
            <Text size="sm">
              {t('lateFees.waive.summary', {
                student: waiveTarget.studentName,
                amount: formatMoney(waiveTarget.lateFeeAmount),
                days: waiveTarget.daysOverdue ?? 0,
              })}
            </Text>
            <Textarea
              id="fees-late-fees-waive-reason"
              label={t('lateFees.waive.reason')}
              placeholder={t('lateFees.waive.reasonPlaceholder')}
              required
              minRows={3}
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button
                id="fees-late-fees-waive-cancel"
                variant="default"
                onClick={closeWaive}
                disabled={waiveMutation.isPending}
              >
                {t('lateFees.waive.cancel')}
              </Button>
              <Button
                id="fees-late-fees-waive-confirm"
                color="orange"
                onClick={() => void submitWaive()}
                disabled={!waiveReason.trim()}
                loading={waiveMutation.isPending && !!waiveReason.trim()}
              >
                {t('lateFees.waive.confirm')}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
