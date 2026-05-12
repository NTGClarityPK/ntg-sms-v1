'use client';

import { useTranslations } from 'next-intl';
import {
  Paper,
  Stack,
  Text,
  Skeleton,
  Badge,
  Group,
  SimpleGrid,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { EarlyDepartureRequest } from '@/types/early-departure';

interface EarlyDepartureReportProps {
  requests: EarlyDepartureRequest[];
  isLoading: boolean;
  startDate?: string;
  endDate?: string;
}

export function EarlyDepartureReport({
  requests,
  isLoading,
  startDate,
  endDate,
}: EarlyDepartureReportProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('earlyDeparture');

  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={120} />
        </Stack>
      </Paper>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;
  const cancelledCount = requests.filter((r) => r.status === 'cancelled').length;
  const excusedCount = requests.filter((r) => r.status === 'excused').length;
  const total = requests.length;

  const cards = [
    <Paper key="total" withBorder p="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          {t('historyTotalOnPage')}
        </Text>
        <Text fw={isMobile ? 700 : 600} size="xl">
          {total}
        </Text>
      </Stack>
    </Paper>,
    <Paper key="pending" withBorder p="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          {t('pending')}
        </Text>
        <Badge variant="filled" color="yellow" size="lg">
          {String(pendingCount)}
        </Badge>
      </Stack>
    </Paper>,
    <Paper key="approved" withBorder p="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          {t('approved')}
        </Text>
        <Badge variant="filled" color="green" size="lg">
          {String(approvedCount)}
        </Badge>
      </Stack>
    </Paper>,
    <Paper key="rejected" withBorder p="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          {t('rejected')}
        </Text>
        <Badge variant="filled" color="red" size="lg">
          {String(rejectedCount)}
        </Badge>
      </Stack>
    </Paper>,
    <Paper key="cancelled" withBorder p="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          {t('cancelled')}
        </Text>
        <Badge variant="filled" color="gray" size="lg">
          {String(cancelledCount)}
        </Badge>
      </Stack>
    </Paper>,
    <Paper key="excused" withBorder p="sm">
      <Stack gap="xs" align="center">
        <Text size="sm" c="dimmed">
          {t('excused')}
        </Text>
        <Badge variant="filled" color="blue" size="lg">
          {String(excusedCount)}
        </Badge>
      </Stack>
    </Paper>,
  ];

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={500} size="lg">
          {t('historyReportTitle')}
        </Text>

        {startDate || endDate ? (
          <Text size="sm" c="dimmed">
            {t('historyPeriodLabel')}:{' '}
            {startDate ? new Date(startDate).toLocaleDateString() : t('historyAllDates')} –{' '}
            {endDate ? new Date(endDate).toLocaleDateString() : t('historyAllDates')}
          </Text>
        ) : null}

        {isMobile ? (
          <SimpleGrid cols={2} spacing="sm">
            {cards}
          </SimpleGrid>
        ) : (
          <Group grow wrap="wrap" gap="sm">
            {cards}
          </Group>
        )}

        {requests.length === 0 ? (
          <Text c="dimmed" ta="center" py="md" size="sm">
            {t('noRequestsForFilters')}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
