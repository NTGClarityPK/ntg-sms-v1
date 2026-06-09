'use client';

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Paper,
  Box,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconDownload, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  exportSubstitutionHistoryCsv,
  useSubstitutionHistory,
  useSubstitutionLoadStats,
  useCancelSubstitution,
} from '@/hooks/useSubstitutions';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import '@mantine/dates/styles.css';

type Preset = 'week' | 'month' | 'custom';

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function presetToRange(preset: 'week' | 'month'): [Date, Date] {
  const end = new Date();
  const start = new Date();
  if (preset === 'week') {
    start.setDate(end.getDate() - 6);
  } else {
    start.setDate(1);
  }
  return [start, end];
}

export function SubstitutionHistoryContent() {
  const t = useTranslations('substitution');
  const colors = useThemeColors();
  const [preset, setPreset] = useState<Preset>('month');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() =>
    presetToRange('month'),
  );
  const [exporting, setExporting] = useState(false);

  const startDate =
    dateRange[0] && dateRange[1] ? formatIso(dateRange[0]) : formatIso(presetToRange('month')[0]);
  const endDate =
    dateRange[0] && dateRange[1] ? formatIso(dateRange[1]) : formatIso(presetToRange('month')[1]);

  const { data: historyResponse, isLoading, error } = useSubstitutionHistory({
    startDate,
    endDate,
    limit: 100,
  });
  const { data: loadStats, isLoading: statsLoading } = useSubstitutionLoadStats(
    startDate,
    endDate,
  );
  const cancelMutation = useCancelSubstitution();

  const rows = historyResponse?.data ?? [];
  const hasOverload = (loadStats ?? []).some((s) => s.isOverloaded);
  const chartData = (loadStats ?? []).slice(0, 12).map((s) => ({
    name: s.staffName.split(' ')[0] ?? s.staffName,
    count: s.substitutionCount,
  }));

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('statusPending');
      case 'confirmed':
        return t('statusConfirmed');
      case 'completed':
        return t('statusCompleted');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };

  const handlePresetChange = (value: string) => {
    const next = value as Preset;
    setPreset(next);
    if (next === 'week' || next === 'month') {
      setDateRange(presetToRange(next));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSubstitutionHistoryCsv({ startDate, endDate, limit: 500 });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group wrap="wrap" align="flex-end" gap="sm">
            <SegmentedControl
              id="substitution-history-preset"
              value={preset}
              onChange={handlePresetChange}
              data={[
                { label: t('filterThisWeek'), value: 'week' },
                { label: t('filterThisMonth'), value: 'month' },
                { label: t('filterCustom'), value: 'custom' },
              ]}
            />
            <Box style={{ minWidth: 0, flex: '1 1 280px' }}>
              <DatePickerInput
                id="substitution-history-date-range"
                type="range"
                label={t('dateRange')}
                placeholder={t('dateRangePlaceholder')}
                value={dateRange}
                onChange={(v) => {
                  setPreset('custom');
                  if (!v || (Array.isArray(v) && !v[0] && !v[1])) {
                    setDateRange([null, null]);
                  } else {
                    setDateRange(v as [Date | null, Date | null]);
                  }
                }}
                leftSection={<IconCalendar size={16} />}
                clearable
              />
            </Box>
            <Button
              id="substitution-export-csv"
              variant="light"
              leftSection={<IconDownload size={18} />}
              loading={exporting}
              disabled={exporting || !dateRange[0] || !dateRange[1]}
              onClick={handleExport}
            >
              {t('exportCsv')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      {isLoading || !historyResponse ? (
        <Skeleton height={160} />
      ) : error ? (
        <Alert color="red">{t('errorLoading')}</Alert>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('date')}</Table.Th>
              <Table.Th>{t('absentTeacherCol')}</Table.Th>
              <Table.Th>{t('substituteCol')}</Table.Th>
              <Table.Th>{t('periodsCol')}</Table.Th>
              <Table.Th>{t('statusCol')}</Table.Th>
              <Table.Th>{t('actionsCol')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.absenceDate}</Table.Td>
                <Table.Td>{row.absentTeacherName}</Table.Td>
                <Table.Td>{row.substituteTeacherName}</Table.Td>
                <Table.Td>
                  {row.periodLabel}
                  {row.className && row.sectionName
                    ? ` — ${row.className} ${row.sectionName}`
                    : ''}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{statusLabel(row.status)}</Badge>
                </Table.Td>
                <Table.Td>
                  {row.status !== 'cancelled' ? (
                    <Tooltip label={t('removeSubstitution')}>
                      <ActionIcon
                        id={`substitution-history-cancel-${row.id}`}
                        variant="subtle"
                        color="red"
                        aria-label={t('removeSubstitution')}
                        loading={
                          cancelMutation.isPending &&
                          cancelMutation.variables === row.id
                        }
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(row.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>{t('loadChartTitle')}</Text>
          {hasOverload ? (
            <Badge color="orange" variant="filled">
              {t('overloadBadge')}
            </Badge>
          ) : null}
        </Group>
        {statsLoading ? (
          <Skeleton height={220} />
        ) : chartData.length === 0 ? (
          <Text c="dimmed" size="sm">
            —
          </Text>
        ) : (
          <Box h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" fill={colors.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
