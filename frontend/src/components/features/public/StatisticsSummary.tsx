'use client';

import { Paper, Group, Text } from '@mantine/core';

export interface StatisticsSummaryProps {
  total: number;
  male: number;
  female: number;
}

export function StatisticsSummary({ total, male, female }: StatisticsSummaryProps) {
  return (
    <Paper p="md" withBorder mb="md">
      <Text fw={600} mb="xs">
        Summary
      </Text>
      <Group gap="xl">
        <Text size="sm">
          <Text span fw={500}>Total students: </Text>
          {total}
        </Text>
        <Text size="sm">
          <Text span fw={500}>Boys: </Text>
          {male}
        </Text>
        <Text size="sm">
          <Text span fw={500}>Girls: </Text>
          {female}
        </Text>
      </Group>
    </Paper>
  );
}
