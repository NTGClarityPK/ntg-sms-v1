'use client';

import { Paper, Table, Text, Group, Chip, Stack, Skeleton, Alert, Button } from '@mantine/core';
import { useStorageAlerts, useAcknowledgeStorageAlert } from '@/hooks/useStorage';
import { Badge } from '@mantine/core';

const ALERT_FILTER_CHIPS = ['all', 'unacknowledged', 'warning', 'critical', 'exceeded'] as const;

interface StorageAlertsProps {
  filterChip: string;
  onFilterChipChange: (v: string) => void;
}

export function StorageAlerts({ filterChip, onFilterChipChange }: StorageAlertsProps) {
  const filter =
    filterChip === 'all'
      ? undefined
      : (filterChip as 'warning' | 'critical' | 'exceeded' | 'unacknowledged');
  const { data: alerts, isLoading, error } = useStorageAlerts(filter);
  const acknowledgeAlert = useAcknowledgeStorageAlert();

  if (isLoading || !alerts) {
    return (
      <Paper p="md" withBorder>
        <Skeleton height={120} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error">
        {error instanceof Error ? error.message : 'Failed to load alerts'}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={500}>
            Filter:
          </Text>
          <Chip.Group
            value={filterChip}
            onChange={(v) =>
              onFilterChipChange(Array.isArray(v) ? v[0] ?? 'all' : v ?? 'all')
            }
          >
            <Group gap="xs">
              {ALERT_FILTER_CHIPS.map((c) => (
                <Chip key={c} value={c} variant="filled">
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={600} mb="sm">
          Storage alerts
        </Text>
        {alerts.length === 0 ? (
          <Text size="sm" c="dimmed">
            No alerts.
          </Text>
        ) : (
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Percentage used</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
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
                      {a.alertType}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{a.percentageUsed}%</Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(a.createdAt).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>{a.acknowledged ? 'Acknowledged' : 'Active'}</Table.Td>
                  <Table.Td>
                    {!a.acknowledged && (
                      <Button
                        variant="light"
                        size="xs"
                        onClick={() => acknowledgeAlert.mutate(a.id)}
                        loading={acknowledgeAlert.isPending}
                      >
                        Acknowledge
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
