'use client';

import { Modal, Table, Text, Loader, Paper, Group } from '@mantine/core';
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
  const { data, isLoading, error } = useClassSectionStudents(
    opened ? classSectionId : null,
  );

  const students = (data && 'data' in data ? data.data : (Array.isArray(data) ? data : [])) as any[];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Students in Class Section"
      size="lg"
    >
      {isLoading && (
        <Group justify="center" py="xl">
          <Loader size="lg" />
        </Group>
      )}

      {error && (
        <Text c="red" size="sm">
          Error loading students: {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      )}

      {!isLoading && !error && (
        <>
          {students.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No students enrolled in this class section.
            </Text>
          ) : (
            <Paper p="md" withBorder>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Student ID</Table.Th>
                    <Table.Th>Name</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {students.map((student) => (
                    <Table.Tr key={student.id}>
                      <Table.Td>{student.studentId}</Table.Td>
                      <Table.Td>{student.fullName}</Table.Td>
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

