'use client';

import { Group, Title, Table, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { usePublicClassCounts } from '@/hooks/useReports';

export default function PublicClassCountsPage() {
  const { data: counts, isLoading } = usePublicClassCounts();
  const t = useTranslations('reports');

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('publicStudentCountsTitle')}</Title>
        </Group>
      </div>
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          <Paper withBorder p="md">
            <Text fw={600} mb="md">{t('publicStudentCountsTitle')}</Text>
            {isLoading ? (
              <Stack gap="sm">
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            ) : counts && counts.length > 0 ? (
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('publicTableClass')}</Table.Th>
                    <Table.Th>{t('publicTableSection')}</Table.Th>
                    <Table.Th>{t('publicTableTotalStudents')}</Table.Th>
                    <Table.Th>{t('publicTableBoys')}</Table.Th>
                    <Table.Th>{t('publicTableGirls')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {counts.map((count) => (
                    <Table.Tr key={count.classSectionId}>
                      <Table.Td>{count.className}</Table.Td>
                      <Table.Td>{count.sectionName}</Table.Td>
                      <Table.Td>{count.totalStudents}</Table.Td>
                      <Table.Td>{count.maleCount}</Table.Td>
                      <Table.Td>{count.femaleCount}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">{t('publicNoData')}</Text>
            )}
          </Paper>
        </Stack>
      </div>
    </>
  );
}
