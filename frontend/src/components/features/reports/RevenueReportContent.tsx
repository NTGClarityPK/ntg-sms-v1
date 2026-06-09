'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Group,
  Menu,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import {
  IconFileExport,
  IconFileSpreadsheet,
  IconFileTypePdf,
} from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRevenueReport, type RevenueQueryScope } from '@/hooks/useReports';
import { useTenantBranches } from '@/hooks/useBranches';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import type { RevenueDetailMode, RevenueSourceKey } from '@/types/reports';

export interface RevenueReportContentProps {
  isActive: boolean;
}

function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  if (period === 'year') {
    const y = now.getFullYear();
    return { startDate: `${y}-01-01`, endDate: now.toISOString().split('T')[0] };
  }
  if (period === 'week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
    };
  }
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0);
  return {
    startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    endDate: last.toISOString().split('T')[0],
  };
}

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

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const PAYMENT_METHOD_KEYS = ['Bank_Transfer', 'Cash', 'Online', 'Cheque', 'Unknown'] as const;

export function RevenueReportContent({ isActive }: RevenueReportContentProps) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const { user } = useAuth();
  const [periodChip, setPeriodChip] = useState<string>('month');
  const [scopeMode, setScopeMode] = useState<'current' | 'combined' | 'pick'>('current');
  const [pickedBranchId, setPickedBranchId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<RevenueDetailMode>('summary');
  const [exportLoading, setExportLoading] = useState(false);

  const { startDate, endDate } = useMemo(() => getPeriodDates(periodChip), [periodChip]);
  const branchesQuery = useTenantBranches();
  const tenantBranches = branchesQuery.data?.data ?? [];
  const currentBranchId = user?.currentBranch?.id ?? null;
  const hasMultipleBranches = tenantBranches.length > 1;

  const apiScope: RevenueQueryScope = useMemo(() => {
    if (scopeMode === 'combined') return 'combined';
    if (scopeMode === 'pick' && pickedBranchId) return 'branch';
    return 'current';
  }, [scopeMode, pickedBranchId]);

  const reportQuery = useRevenueReport({
    scope: apiScope,
    branchId: scopeMode === 'pick' ? pickedBranchId : null,
    startDate,
    endDate,
    detail: detailMode,
    locale,
    enabled: isActive,
  });

  const paymentMethodLabel = (key: string): string => {
    const normalized = PAYMENT_METHOD_KEYS.includes(key as (typeof PAYMENT_METHOD_KEYS)[number])
      ? key
      : 'Unknown';
    return t(`revenuePaymentMethods.${normalized}`);
  };

  const personTypeLabel = (key: string): string => {
    const known = ['student', 'staff', 'admin', 'visitor'] as const;
    if (known.includes(key as (typeof known)[number])) {
      return t(`revenuePersonTypes.${key}`);
    }
    return key;
  };

  const sourceLabel = (key: RevenueSourceKey): string => {
    if (key === 'fee_management') return t('revenueSources.fee_management');
    if (key === 'id_card_reprints') return t('revenueSources.id_card_reprints');
    return key;
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({
        format,
        scope: apiScope,
        startDate,
        endDate,
        detail: detailMode,
        locale,
      });
      if (apiScope === 'branch' && pickedBranchId) {
        params.set('branchId', pickedBranchId);
      }
      const blob = await apiClient.getBlob(`/api/v1/reports/revenue/export?${params}`);
      triggerDownload(blob, `revenue-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const scopeSegmentData = useMemo(() => {
    const items: Array<{ value: string; label: string }> = [
      { value: 'current', label: t('revenueScopeCurrent') },
    ];
    if (hasMultipleBranches) {
      items.push({ value: 'combined', label: t('revenueScopeCombined') });
      items.push({ value: 'pick', label: t('revenueScopeBranch') });
    }
    return items;
  }, [hasMultipleBranches, t]);

  const report = reportQuery.data;
  const showBranchTable =
    report && detailMode === 'summary' && (report.scope === 'combined' || report.byBranch.length > 1);
  const showPaymentMethods =
    report?.feeManagement?.byPaymentMethod &&
    report.feeManagement.byPaymentMethod.length > 0 &&
    detailMode === 'summary';
  const showCombinedBranchCol = report?.scope === 'combined';

  return (
    <Stack gap="md" px="md" pb="md">
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap" gap="sm" align="center">
            <Group gap="xs" wrap="wrap" className="filter-chip-group">
              <Text size="sm" fw={500}>
                {t('adminPeriodLabel')}
              </Text>
              <Chip.Group
                value={periodChip}
                onChange={(v) =>
                  setPeriodChip(Array.isArray(v) ? (v[0] ?? 'month') : (v ?? 'month'))
                }
              >
                <Group gap="xs">
                  <Chip value="week" variant="filled">
                    {t('adminChipWeek')}
                  </Chip>
                  <Chip value="month" variant="filled">
                    {t('adminChipMonth')}
                  </Chip>
                  <Chip value="year" variant="filled">
                    {t('adminChipYear')}
                  </Chip>
                </Group>
              </Chip.Group>
            </Group>
            <Menu shadow="md" width={160} disabled={exportLoading}>
              <Menu.Target>
                <Button
                  id="reports-revenue-export"
                  leftSection={exportLoading ? undefined : <IconFileExport size={16} />}
                  variant="light"
                  loading={exportLoading}
                  disabled={!report}
                >
                  {t('adminExport')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={14} />}
                  onClick={() => handleExport('pdf')}
                >
                  {t('adminExportPdf')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileSpreadsheet size={14} />}
                  onClick={() => handleExport('excel')}
                >
                  {t('adminExportExcel')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Group justify="space-between" wrap="wrap" align="center">
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {t('revenueDetailModeLabel')}
              </Text>
              <Text size="xs" c="dimmed">
                {detailMode === 'detailed'
                  ? t('revenueDetailModeDetailedHint')
                  : t('revenueDetailModeSummaryHint')}
              </Text>
            </Stack>
            <Switch
              id="reports-revenue-detail-mode"
              label={t('revenueDetailModeToggle')}
              checked={detailMode === 'detailed'}
              onChange={(e) =>
                setDetailMode(e.currentTarget.checked ? 'detailed' : 'summary')
              }
            />
          </Group>

          {scopeSegmentData.length > 1 && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {t('revenueBranchScopeLabel')}
              </Text>
              <SegmentedControl
                id="reports-revenue-scope"
                value={scopeMode}
                onChange={(v) => setScopeMode(v as 'current' | 'combined' | 'pick')}
                data={scopeSegmentData}
              />
            </Stack>
          )}

          {scopeMode === 'pick' && (
            <Select
              id="reports-revenue-branch"
              label={t('revenueBranchSelectLabel')}
              placeholder={t('revenueBranchSelectPlaceholder')}
              data={tenantBranches.map((b) => ({
                value: b.id,
                label: b.code ? `${b.name} (${b.code})` : b.name,
              }))}
              value={pickedBranchId}
              onChange={setPickedBranchId}
              searchable
              style={{ maxWidth: 360 }}
            />
          )}

          {scopeMode === 'current' && currentBranchId && (
            <Text size="sm" c="dimmed">
              {t('revenueCurrentBranchHint', {
                name:
                  tenantBranches.find((b) => b.id === currentBranchId)?.name ??
                  user?.currentBranch?.name ??
                  '',
              })}
            </Text>
          )}
        </Stack>
      </Paper>

      {reportQuery.isLoading || reportQuery.isFetching ? (
        <Skeleton height={200} />
      ) : reportQuery.error ? (
        <Alert color="red">{String(reportQuery.error.message ?? t('revenueLoadFailed'))}</Alert>
      ) : !report ? (
        <Text size="sm" c="dimmed">
          {t('revenueEmpty')}
        </Text>
      ) : report.grandTotal === 0 &&
        report.sources.every((s) => !s.enabled || s.total === 0) ? (
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">
            {t('revenueEmpty')}
          </Text>
        </Paper>
      ) : (
        <>
          {report.branding && (
            <Text size="sm" c="dimmed">
              {report.branding.schoolName}
              {report.branding.branchSubtitle
                ? ` · ${report.branding.branchSubtitle}`
                : ''}
            </Text>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <Paper p="md" withBorder>
              <Text fw={600}>{t('revenueGrandTotal')}</Text>
              <Text size="xl" mt="xs">
                {formatAmount(report.grandTotal)}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                {report.startDate} – {report.endDate}
              </Text>
            </Paper>
            {report.sources.map((s) => (
              <Paper key={s.sourceKey} p="md" withBorder opacity={s.enabled ? 1 : 0.65}>
                <Text fw={600}>{sourceLabel(s.sourceKey)}</Text>
                {!s.enabled ? (
                  <Text size="sm" c="dimmed" mt="xs">
                    {t('revenueSourceNotOnPlan')}
                  </Text>
                ) : (
                  <>
                    <Text size="xl" mt="xs">
                      {formatAmount(s.total)}
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs">
                      {t('revenueTransactionCount', { count: s.transactionCount })}
                    </Text>
                  </>
                )}
              </Paper>
            ))}
          </SimpleGrid>

          {showBranchTable && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {t('revenueByBranch')}
              </Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('revenueTableBranch')}</Table.Th>
                    <Table.Th>{t('revenueSources.fee_management')}</Table.Th>
                    <Table.Th>{t('revenueSources.id_card_reprints')}</Table.Th>
                    <Table.Th>{t('revenueTableTotal')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.byBranch.map((row) => (
                    <Table.Tr key={row.branchId}>
                      <Table.Td>{row.branchName}</Table.Td>
                      <Table.Td>{formatAmount(row.sources.fee_management ?? 0)}</Table.Td>
                      <Table.Td>{formatAmount(row.sources.id_card_reprints ?? 0)}</Table.Td>
                      <Table.Td>{formatAmount(row.total)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {showPaymentMethods && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {t('revenueFeeByPaymentMethod')}
              </Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('revenuePaymentMethod')}</Table.Th>
                    <Table.Th>{t('revenueTableTotal')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.feeManagement!.byPaymentMethod.map((m) => (
                    <Table.Tr key={m.methodKey}>
                      <Table.Td>{paymentMethodLabel(m.methodKey)}</Table.Td>
                      <Table.Td>{formatAmount(m.total)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {detailMode === 'detailed' && (report.feeLines?.length ?? 0) > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {t('revenueDetailedFeesTitle')}
              </Text>
              <Table withTableBorder withColumnBorders striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    {showCombinedBranchCol && (
                      <Table.Th>{t('revenueTableBranch')}</Table.Th>
                    )}
                    <Table.Th>{t('revenueTableStudent')}</Table.Th>
                    <Table.Th>{t('revenueTableChallan')}</Table.Th>
                    <Table.Th>{t('revenuePaymentMethod')}</Table.Th>
                    <Table.Th>{t('revenueTableDate')}</Table.Th>
                    <Table.Th>{t('revenueTableTotal')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.feeLines!.map((line) => (
                    <Table.Tr key={line.id}>
                      {showCombinedBranchCol && (
                        <Table.Td>{line.branchName ?? '—'}</Table.Td>
                      )}
                      <Table.Td>{line.personName}</Table.Td>
                      <Table.Td>{line.challanNumber ?? '—'}</Table.Td>
                      <Table.Td>{paymentMethodLabel(line.paymentMethodKey)}</Table.Td>
                      <Table.Td>{line.paymentDate}</Table.Td>
                      <Table.Td>{formatAmount(line.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {detailMode === 'detailed' && (report.idCardLines?.length ?? 0) > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {t('revenueDetailedIdCardsTitle')}
              </Text>
              <Table withTableBorder withColumnBorders striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    {showCombinedBranchCol && (
                      <Table.Th>{t('revenueTableBranch')}</Table.Th>
                    )}
                    <Table.Th>{t('revenueTablePerson')}</Table.Th>
                    <Table.Th>{t('revenueTablePersonType')}</Table.Th>
                    <Table.Th>{t('revenueTableCardNumber')}</Table.Th>
                    <Table.Th>{t('revenueTableDate')}</Table.Th>
                    <Table.Th>{t('revenueTableTotal')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.idCardLines!.map((line) => (
                    <Table.Tr key={line.id}>
                      {showCombinedBranchCol && (
                        <Table.Td>{line.branchName ?? '—'}</Table.Td>
                      )}
                      <Table.Td>{line.personName}</Table.Td>
                      <Table.Td>{personTypeLabel(line.personType)}</Table.Td>
                      <Table.Td>{line.cardNumber ?? '—'}</Table.Td>
                      <Table.Td>{line.eventDate}</Table.Td>
                      <Table.Td>{formatAmount(line.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {detailMode === 'detailed' &&
            !report.feeLines?.length &&
            !report.idCardLines?.length && (
              <Text size="sm" c="dimmed">
                {t('revenueEmpty')}
              </Text>
            )}
        </>
      )}
    </Stack>
  );
}
