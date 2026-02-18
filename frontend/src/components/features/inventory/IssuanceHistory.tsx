'use client';

import { Table, Text, Stack } from '@mantine/core';
import type { UniformIssuance } from '@/types/inventory';

interface IssuanceHistoryProps {
  issuances: UniformIssuance[];
  isLoading?: boolean;
}

export function IssuanceHistory({ issuances, isLoading }: IssuanceHistoryProps) {
  if (isLoading) return null;
  if (!issuances || issuances.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No issuance history for this student.
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Item</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Issued by</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {issuances.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>
                {new Date(row.issuedAt).toLocaleDateString(undefined, {
                  dateStyle: 'short',
                })}
              </Table.Td>
              <Table.Td>{row.uniformItemName ?? row.uniformItemId}</Table.Td>
              <Table.Td>{row.size}</Table.Td>
              <Table.Td>{row.quantity}</Table.Td>
              <Table.Td>{row.issuerName ?? row.issuedBy}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
