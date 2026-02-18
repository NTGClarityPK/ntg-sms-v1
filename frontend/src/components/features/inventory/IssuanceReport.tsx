'use client';

import { Table, Text, Paper } from '@mantine/core';
import type { IssuanceReportRow } from '@/types/inventory';

interface IssuanceReportProps {
  rows: IssuanceReportRow[];
  isLoading?: boolean;
}

export function IssuanceReport({ rows, isLoading }: IssuanceReportProps) {
  if (isLoading) return null;
  if (!rows || rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No issuances match the filters.
      </Text>
    );
  }

  return (
    <Paper withBorder p="md">
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Student</Table.Th>
            <Table.Th>Item</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Issued by</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, i) => (
            <Table.Tr key={`${row.studentId}-${row.uniformItemId}-${row.issuedAt}-${i}`}>
              <Table.Td>
                {new Date(row.issuedAt).toLocaleDateString(undefined, {
                  dateStyle: 'short',
                })}
              </Table.Td>
              <Table.Td>{row.studentName ?? row.studentId ?? '—'}</Table.Td>
              <Table.Td>{row.uniformItemName ?? row.uniformItemId}</Table.Td>
              <Table.Td>{row.size}</Table.Td>
              <Table.Td>{row.quantity}</Table.Td>
              <Table.Td>{row.issuerName ?? '-'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
