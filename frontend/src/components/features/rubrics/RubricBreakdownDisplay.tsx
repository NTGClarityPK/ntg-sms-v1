'use client';

import { Stack, Table, Text, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { RubricCategory } from '@/types/rubrics';

interface RubricBreakdownDisplayProps {
  categories: RubricCategory[];
  totalMarks?: number;
}

export function RubricBreakdownDisplay({ categories, totalMarks }: RubricBreakdownDisplayProps) {
  const t = useTranslations('rubrics');
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const computedTotal =
    totalMarks ?? sorted.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);

  if (sorted.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t('noRubric')}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Title order={5}>{t('breakdown')}</Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('categoryName')}</Table.Th>
            <Table.Th>{t('categoryCode')}</Table.Th>
            <Table.Th>{t('maxMarks')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((cat) => (
            <Table.Tr key={cat.id}>
              <Table.Td>{cat.categoryName}</Table.Td>
              <Table.Td>{cat.categoryCode || '—'}</Table.Td>
              <Table.Td>{cat.maxMarks}</Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td colSpan={2}>
              <Text fw={600}>{t('totalMarks')}</Text>
            </Table.Td>
            <Table.Td>
              <Text fw={600}>{computedTotal}</Text>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
