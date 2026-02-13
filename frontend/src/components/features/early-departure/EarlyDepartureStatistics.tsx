'use client';

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
          No statistics available. No early departure requests have been submitted yet.
        </Text>
      </Paper>
    );
  }

  return (
      <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Student</Table.Th>
          <Table.Th>Total Requests</Table.Th>
          <Table.Th>Approved</Table.Th>
          <Table.Th>Rejected</Table.Th>
          <Table.Th>Cancelled</Table.Th>
          <Table.Th>Pending</Table.Th>
          <Table.Th>Excused</Table.Th>
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
