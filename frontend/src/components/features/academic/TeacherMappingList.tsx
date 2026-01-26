'use client';

import { useState } from 'react';
import {
  Paper,
  Table,
  Group,
  Text,
  Badge,
  ActionIcon,
  Pagination,
  MultiSelect,
  Stack,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { useDeleteTeacherAssignment, useUpdateTeacherAssignment } from '@/hooks/useTeacherAssignments';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useDisclosure } from '@mantine/hooks';
import { CreateAssignmentModal } from './CreateAssignmentModal';
import { useClassSections } from '@/hooks/useClassSections';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useStaff } from '@/hooks/useStaff';

interface TeacherMappingListProps {
  assignments: TeacherAssignment[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
}

export function TeacherMappingList({
  assignments,
  meta,
  onPageChange,
}: TeacherMappingListProps) {
  const deleteAssignment = useDeleteTeacherAssignment();
  const updateAssignment = useUpdateTeacherAssignment();
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
  const [teacherFilter, setTeacherFilter] = useState<string[]>([]);

  const { data: classSectionsData } = useClassSections();
  const { data: subjectsData } = useSubjects();
  const { data: staffData } = useStaff();

  const classSections = classSectionsData?.data || [];
  const subjects = subjectsData?.data || [];
  const staff = staffData?.data || [];

  // Get unique values for filters
  const classOptions = Array.from(
    new Set(classSections.map((cs) => cs.classDisplayName || cs.className || '').filter(Boolean)),
  ).map((name) => ({ value: name, label: name }));

  const sectionOptions = Array.from(
    new Set(classSections.map((cs) => cs.sectionName || '').filter(Boolean)),
  ).map((name) => ({ value: name, label: name }));

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));

  const teacherOptions = staff
    .filter((s) => s.isActive)
    .map((s) => ({ value: s.id, label: s.fullName || s.employeeId || 'Unknown' }));

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment) => {
    if (classFilter.length > 0 && !classFilter.includes(assignment.className || '')) {
      return false;
    }
    if (sectionFilter.length > 0 && !sectionFilter.includes(assignment.sectionName || '')) {
      return false;
    }
    if (subjectFilter.length > 0 && !subjectFilter.includes(assignment.subjectId)) {
      return false;
    }
    if (teacherFilter.length > 0 && !teacherFilter.includes(assignment.staffId)) {
      return false;
    }
    return true;
  });

  const handleEdit = (assignment: TeacherAssignment) => {
    setSelectedAssignment(assignment);
    openEdit();
  };

  const handleDelete = (assignment: TeacherAssignment) => {
    modals.openConfirmModal({
      title: 'Delete Teacher Assignment',
      children: (
        <Text size="sm">
          Are you sure you want to delete the assignment for {assignment.subjectName} in{' '}
          {assignment.classSectionName}?
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteAssignment.mutate(assignment.id);
      },
    });
  };

  return (
    <>
      <Stack gap="md">
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group>
              <MultiSelect
                label="Filter by Class"
                placeholder="Select classes"
                data={classOptions}
                value={classFilter}
                onChange={setClassFilter}
                clearable
                style={{ flex: 1 }}
              />
              <MultiSelect
                label="Filter by Section"
                placeholder="Select sections"
                data={sectionOptions}
                value={sectionFilter}
                onChange={setSectionFilter}
                clearable
                style={{ flex: 1 }}
              />
              <MultiSelect
                label="Filter by Subject"
                placeholder="Select subjects"
                data={subjectOptions}
                value={subjectFilter}
                onChange={setSubjectFilter}
                clearable
                style={{ flex: 1 }}
              />
              <MultiSelect
                label="Filter by Teacher"
                placeholder="Select teachers"
                data={teacherOptions}
                value={teacherFilter}
                onChange={setTeacherFilter}
                clearable
                style={{ flex: 1 }}
              />
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Class-Section</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th>Teacher</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAssignments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center" py="xl">
                      No teacher assignments found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <Table.Tr key={assignment.id}>
                    <Table.Td>{assignment.classSectionName || 'Unknown'}</Table.Td>
                    <Table.Td>{assignment.subjectName || 'Unknown'}</Table.Td>
                    <Table.Td>{assignment.staffName || 'Unknown'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => handleEdit(assignment)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(assignment)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>

          {meta && meta.totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                total={meta.totalPages}
                value={meta.page}
                onChange={(page) => onPageChange?.(page)}
              />
            </Group>
          )}
        </Paper>
      </Stack>

      <CreateAssignmentModal
        opened={editOpened}
        onClose={closeEdit}
        assignment={selectedAssignment}
      />
    </>
  );
}

