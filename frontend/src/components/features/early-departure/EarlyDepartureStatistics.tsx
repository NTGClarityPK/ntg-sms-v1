'use client';

import { useTranslations } from 'next-intl';
import { Table, Badge, Text, Group, Stack, Paper, Skeleton } from '@mantine/core';
import type { StudentEarlyDepartureStatistics } from '@/hooks/useEarlyDepartures';

interface EarlyDepartureStatisticsProps {
  statistics: StudentEarlyDepartureStatistics[];
  isLoading?: boolean;
}

export function EarlyDepartureStatistics({
  statistics,
  isLoading,
}: EarlyDepartureStatisticsProps) {
  const t = useTranslations('earlyDeparture');
  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={400} />
      </Stack>
    );
  }

  if (!statistics || statistics.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed" ta="center">
          {t('noStatisticsAvailable')}
        </Text>
      </Paper>
    );
  }

  return (
      <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('student')}</Table.Th>
          <Table.Th>{t('totalRequests')}</Table.Th>
          <Table.Th>{t('approved')}</Table.Th>
          <Table.Th>{t('rejected')}</Table.Th>
          <Table.Th>{t('cancelled')}</Table.Th>
          <Table.Th>{t('pending')}</Table.Th>
          <Table.Th>{t('excused')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {statistics.map((stat) => (
          <Table.Tr key={stat.studentId}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {stat.studentName}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color="blue" size="sm">
                {stat.totalRequests}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color="green" size="sm">
                {stat.totalApproved}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color="red" size="sm">
                {stat.totalRejected}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color="gray" size="sm">
                {stat.totalCancelled}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color="yellow" size="sm">
                {stat.totalPending}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge variant="light" color="blue" size="sm">
                {stat.totalExcused}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
