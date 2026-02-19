'use client';

import { Table, Paper, Text } from '@mantine/core';
import type { ClassStudentCount } from '@/hooks/useReports';

export interface StudentCountTableProps {
  data: ClassStudentCount[];
}

export function StudentCountTable({ data }: StudentCountTableProps) {
  if (!data.length) {
    return (
      <Paper p="md" withBorder>
        <Text size="sm" c="dimmed">
          No class data available.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Text fw={600} mb="md">
        Students per class
      </Text>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Class</Table.Th>
            <Table.Th>Section</Table.Th>
            <Table.Th>Total</Table.Th>
            <Table.Th>Boys</Table.Th>
            <Table.Th>Girls</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((row) => (
            <Table.Tr key={row.classSectionId}>
              <Table.Td>{row.className}</Table.Td>
              <Table.Td>{row.sectionName}</Table.Td>
              <Table.Td>{row.totalStudents}</Table.Td>
              <Table.Td>{row.maleCount}</Table.Td>
              <Table.Td>{row.femaleCount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
