'use client';

import { Modal, Table, Text, Skeleton, Paper, Group, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useClassSectionStudents } from '@/hooks/useClassSections';

interface ClassSectionStudentsModalProps {
  opened: boolean;
  onClose: () => void;
  classSectionId: string;
}

export function ClassSectionStudentsModal({
  opened,
  onClose,
  classSectionId,
}: ClassSectionStudentsModalProps) {
  const t = useTranslations('class');
  const { data, isLoading, error } = useClassSectionStudents(
    opened ? classSectionId : null,
  );

  const students = (data && 'data' in data ? data.data : (Array.isArray(data) ? data : [])) as any[];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('studentsInClassSection')}
      size="lg"
    >
      {isLoading && (
        <Stack gap="md" py="xl">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={50} />
        </Stack>
      )}

      {error && (
        <Text c="red" size="sm">
          {t('errorLoadingStudents', { message: error instanceof Error ? error.message : 'Unknown error' })}
        </Text>
      )}

      {!isLoading && !error && (
        <>
          {students.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {t('noStudentsEnrolled')}
            </Text>
          ) : (
            <Paper p="md" withBorder>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('studentId')}</Table.Th>
                    <Table.Th>{t('name')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {students.map((student) => (
                    <Table.Tr key={student.id}>
                      <Table.Td>{student.studentId}</Table.Td>
                      <Table.Td>{`${student.firstName} ${student.lastName}`.trim() || 'N/A'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </Modal>
  );
}

