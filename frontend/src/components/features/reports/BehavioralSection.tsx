'use client';

import { Table, Paper, Text, Skeleton } from '@mantine/core';
import type { BehavioralSection as BehavioralSectionType } from '@/types/reports';
import { StarRating } from '@/components/features/behavioral/StarRating';

interface BehavioralSectionProps {
  data: BehavioralSectionType | null | undefined;
  isLoading: boolean;
}

export function BehavioralSectionReport({ data, isLoading }: BehavioralSectionProps) {
  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={80} radius="sm" />
      </Paper>
    );
  }

  if (!data || !data.periods || data.periods.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text fw={600} mb="xs">Behavioral</Text>
        <Text c="dimmed" size="sm">No behavioral assessments.</Text>
      </Paper>
    );
  }

  const allAttributes = Array.from(
    new Set(data.periods.flatMap((p) => p.attributes.map((a) => a.attributeName))),
  ).sort();

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="md">Behavioral</Text>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Period</Table.Th>
            {allAttributes.map((attr) => (
              <Table.Th key={attr}>{attr}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.periods.map((p) => {
            const attrMap = Object.fromEntries(
              p.attributes.map((a) => [a.attributeName, a.average]),
            );
            return (
              <Table.Tr key={p.period}>
                <Table.Td>{p.period}</Table.Td>
                {allAttributes.map((attr) => (
                  <Table.Td key={attr}>
                    {attrMap[attr] != null ? (
                      <StarRating value={attrMap[attr]} readonly size={18} />
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                ))}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
