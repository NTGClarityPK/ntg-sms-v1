'use client';

import { Group, Title, Table, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { usePublicClassCounts } from '@/hooks/useReports';

export default function PublicClassCountsPage() {
  const { data: counts, isLoading } = usePublicClassCounts();

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Class Student Count</Title>
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
            <Text fw={600} mb="md">Student Counts by Class</Text>
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
                    <Table.Th>Class</Table.Th>
                    <Table.Th>Section</Table.Th>
                    <Table.Th>Total Students</Table.Th>
                    <Table.Th>Boys</Table.Th>
                    <Table.Th>Girls</Table.Th>
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
              <Text c="dimmed" size="sm">No class data available.</Text>
            )}
          </Paper>
        </Stack>
      </div>
    </>
  );
}
