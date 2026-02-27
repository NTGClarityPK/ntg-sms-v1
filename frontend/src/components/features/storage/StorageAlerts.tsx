'use client';

import { Paper, Table, Text, Group, Chip, Stack, Skeleton, Alert, Button, Badge } from '@mantine/core';
import { useStorageAlerts, useAcknowledgeStorageAlert } from '@/hooks/useStorage';
import { useTranslations } from 'next-intl';

const ALERT_FILTER_CHIPS = ['all', 'unacknowledged', 'warning', 'critical', 'exceeded'] as const;
type AlertFilterChip = typeof ALERT_FILTER_CHIPS[number];

interface StorageAlertsProps {
  filterChip: string;
  onFilterChipChange: (v: string) => void;
}

export function StorageAlerts({ filterChip, onFilterChipChange }: StorageAlertsProps) {
  const t = useTranslations('storage');
  const filter =
    filterChip === 'all'
      ? undefined
      : (filterChip as 'warning' | 'critical' | 'exceeded' | 'unacknowledged');
  const { data: alerts, isLoading, error } = useStorageAlerts(filter);
  const acknowledgeAlert = useAcknowledgeStorageAlert();

  const getFilterLabel = (c: AlertFilterChip): string => {
    const map: Record<AlertFilterChip, string> = {
      all: t('alertFilterAll'),
      unacknowledged: t('alertFilterUnacknowledged'),
      warning: t('alertFilterWarning'),
      critical: t('alertFilterCritical'),
      exceeded: t('alertFilterExceeded'),
    };
    return map[c];
  };

  const getAlertTypeLabel = (alertType: string): string => {
    if (alertType === 'warning') return t('alertTypeWarning');
    if (alertType === 'critical') return t('alertTypeCritical');
    if (alertType === 'exceeded') return t('alertTypeExceeded');
    return alertType;
  };

  if (isLoading || !alerts) {
    return (
      <Paper p="md" withBorder>
        <Skeleton height={120} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title={t('alertsLoadError')}>
        {error instanceof Error ? error.message : t('alertsLoadError')}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={500}>{t('alertFilterLabel')}</Text>
          <Chip.Group
            value={filterChip}
            onChange={(v) =>
              onFilterChipChange(Array.isArray(v) ? v[0] ?? 'all' : v ?? 'all')
            }
          >
            <Group gap="xs">
              {ALERT_FILTER_CHIPS.map((c) => (
                <Chip key={c} value={c} variant="filled">
                  {getFilterLabel(c)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">{t('alertsTitle')}</Text>
        {alerts.length === 0 ? (
          <Text size="sm" c="dimmed">{t('alertsNoData')}</Text>
        ) : (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('alertsColType')}</Table.Th>
                <Table.Th>{t('alertsColPercentage')}</Table.Th>
                <Table.Th>{t('alertsColDate')}</Table.Th>
                <Table.Th>{t('alertsColStatus')}</Table.Th>
                <Table.Th>{t('alertsColActions') ?? ''}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {alerts.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Badge
                      color={
                        a.alertType === 'exceeded'
                          ? 'red'
                          : a.alertType === 'critical'
                            ? 'orange'
                            : 'yellow'
                      }
                      variant="light"
                    >
                      {getAlertTypeLabel(a.alertType)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{a.percentageUsed}%</Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(a.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    {a.acknowledged ? t('alertStatusAcknowledged') : t('alertStatusActive')}
                  </Table.Td>
                  <Table.Td>
                    {!a.acknowledged && (
                      <Button
                        variant="light"
                        size="xs"
                        onClick={() => acknowledgeAlert.mutate(a.id)}
                        loading={acknowledgeAlert.isPending}
                      >
                        {t('acknowledgeButton')}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
