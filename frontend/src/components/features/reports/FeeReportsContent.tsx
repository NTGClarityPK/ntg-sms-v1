'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Group, Paper, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { apiClient } from '@/lib/api-client';

type Collection = {
  collectedVerified: number;
  pendingPayable: number;
  underReviewPayable: number;
  overduePayable: number;
};
type Defaulter = {
  studentId: string;
  studentName: string;
  challanNumber: string;
  dueDate: string;
  payableAmount: number;
};

/** Fee collection summary + overdue balances table (used on /reports/fees and Reports hub). */
export function FeeReportsContent() {
  const t = useTranslations('feesReports');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [defaulters, setDefaulters] = useState<Defaulter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, dRes] = await Promise.all([
          apiClient.get<Collection>('/api/v1/fees/reports/collection'),
          apiClient.get<Defaulter[]>('/api/v1/fees/reports/defaulters'),
        ]);
        if (cancelled) return;
        // Controllers return { data: T }; apiClient unwraps one layer → { data: T }
        setCollection(cRes.data);
        setDefaulters(Array.isArray(dRes.data) ? dRes.data : []);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t('loadError'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <Stack gap="md">
      {error ? <Alert color="red">{error}</Alert> : null}

      {!collection ? (
        <Skeleton h={120} />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Paper p="md" withBorder>
            <Text fw={600}>{t('cards.collected')}</Text>
            <Text size="xl">{collection.collectedVerified.toLocaleString()}</Text>
          </Paper>
          <Paper p="md" withBorder>
            <Text fw={600}>{t('cards.pending')}</Text>
            <Text size="xl">{collection.pendingPayable.toLocaleString()}</Text>
          </Paper>
          <Paper p="md" withBorder>
            <Text fw={600}>{t('cards.underReview')}</Text>
            <Text size="xl">{collection.underReviewPayable.toLocaleString()}</Text>
          </Paper>
          <Paper p="md" withBorder>
            <Text fw={600}>{t('cards.overdue')}</Text>
            <Text size="xl">{collection.overduePayable.toLocaleString()}</Text>
          </Paper>
        </SimpleGrid>
      )}

      <Text fw={700}>{t('defaulters.title')}</Text>

      {!defaulters ? (
        <Skeleton h={160} />
      ) : defaulters.length === 0 ? (
        <Text>{t('defaulters.empty')}</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('defaulters.table.student')}</Table.Th>
              <Table.Th>{t('defaulters.table.challan')}</Table.Th>
              <Table.Th>{t('defaulters.table.dueDate')}</Table.Th>
              <Table.Th>{t('defaulters.table.amount')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {defaulters.map((d) => (
              <Table.Tr key={`${d.studentId}-${d.challanNumber}`}>
                <Table.Td>{d.studentName}</Table.Td>
                <Table.Td>{d.challanNumber}</Table.Td>
                <Table.Td>{d.dueDate}</Table.Td>
                <Table.Td>{d.payableAmount.toLocaleString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
