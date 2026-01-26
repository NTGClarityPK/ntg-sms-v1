'use client';

import { useState } from 'react';
import { Table, Badge, Group, ActionIcon, Pagination, Text } from '@mantine/core';
import { IconEdit, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import type { Student } from '@/types/students';
import { StudentForm } from './StudentForm';

interface StudentTableProps {
  students: Student[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export function StudentTable({ students, meta, onPageChange, sortBy, sortOrder, onSort }: StudentTableProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    open();
  };

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const isSorted = sortBy === field;
    const isAsc = isSorted && sortOrder === 'asc';
    
    return (
      <Table.Th
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => onSort?.(field)}
      >
        <Group gap="xs" wrap="nowrap">
          <Text fw={500}>{children}</Text>
          {isSorted && (
            isAsc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
          )}
        </Group>
      </Table.Th>
    );
  };

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <SortableHeader field="studentId">Student ID</SortableHeader>
            <SortableHeader field="fullName">Name</SortableHeader>
            <SortableHeader field="className">Class</SortableHeader>
            <SortableHeader field="sectionName">Section</SortableHeader>
            <SortableHeader field="isActive">Status</SortableHeader>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {students.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center" py="md">
                  No students found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            students.map((student) => (
              <Table.Tr key={student.id}>
                <Table.Td>
                  <Text fw={500}>{student.studentId}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{student.fullName || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{student.className || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{student.sectionName || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={student.isActive ? 'green' : 'red'} variant="light">
                    {student.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="light" onClick={() => handleEdit(student)}>
                    <IconEdit size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {meta && meta.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={meta.totalPages} value={meta.page} onChange={onPageChange} />
        </Group>
      )}

      <StudentForm
        opened={opened}
        onClose={() => {
          close();
          setSelectedStudent(null);
        }}
        student={selectedStudent}
      />
    </>
  );
}

