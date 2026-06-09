'use client';

import { Badge, Card, Skeleton, Stack, Table, Text, Alert } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useMySubstitutions } from '@/hooks/useSubstitutions';

export function MySubstitutionsContent() {
  const t = useTranslations('substitution');
  const { data: response, isLoading, error } = useMySubstitutions({ limit: 50 });

  const rows = response?.data ?? [];

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('statusPending');
      case 'confirmed':
        return t('statusConfirmed');
      case 'completed':
        return t('statusCompleted');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };

  return (
    <Card withBorder padding="md">
      {isLoading || !response ? (
        <Skeleton height={120} />
      ) : error ? (
        <Alert color="red">{t('errorLoading')}</Alert>
      ) : rows.length === 0 ? (
        <Text c="dimmed">{t('noAssignments')}</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('date')}</Table.Th>
              <Table.Th>{t('absentTeacherCol')}</Table.Th>
              <Table.Th>{t('periodsCol')}</Table.Th>
              <Table.Th>{t('statusCol')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.absenceDate}</Table.Td>
                <Table.Td>{row.absentTeacherName}</Table.Td>
                <Table.Td>
                  {row.periodLabel}
                  {row.className && row.sectionName
                    ? ` — ${row.className} ${row.sectionName}`
                    : ''}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{statusLabel(row.status)}</Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  );
}
