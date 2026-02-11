'use client';

import { Table, Paper, Text, Skeleton, Stack } from '@mantine/core';
import type { BehavioralAssessment } from '@/types/behavioral';

interface BehavioralHistoryProps {
  assessments: BehavioralAssessment[];
  isLoading: boolean;
}

/**
 * Displays a student's behavioral assessment history (by month with attribute scores).
 */
export function BehavioralHistory({ assessments, isLoading }: BehavioralHistoryProps) {
  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={120} radius="sm" />
      </Paper>
    );
  }

  if (!assessments || assessments.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed">No behavioral assessments yet.</Text>
      </Paper>
    );
  }

  const allAttributes = Array.from(
    new Set(assessments.flatMap((a) => a.scores.map((s) => s.attributeName))),
  ).sort();

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Text fw={600}>History by month</Text>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              {allAttributes.map((attr) => (
                <Table.Th key={attr}>{attr}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {assessments.map((a) => {
              const scoreMap = Object.fromEntries(
                a.scores.map((s) => [s.attributeName, s.score]),
              );
              return (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Text size="sm">
                      {a.assessmentMonth.slice(0, 7)}
                    </Text>
                  </Table.Td>
                  {allAttributes.map((attr) => (
                    <Table.Td key={attr}>
                      <Text size="sm">{scoreMap[attr] ?? '—'}</Text>
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  );
}
