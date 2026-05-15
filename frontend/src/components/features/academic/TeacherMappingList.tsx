'use client';

import { useMemo, useState } from 'react';
import {
  Paper,
  Table,
  Group,
  Text,
  ActionIcon,
  Pagination,
  MultiSelect,
  Stack,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useTranslations } from 'next-intl';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { useDeleteTeacherAssignment, useUpdateTeacherAssignment } from '@/hooks/useTeacherAssignments';
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
  const t = useTranslations('teacher');
  const deleteAssignment = useDeleteTeacherAssignment();
  const updateAssignment = useUpdateTeacherAssignment();
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null);
  const [selectedClassSectionIds, setSelectedClassSectionIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  const { data: classSectionsData } = useClassSections({
    limit: 500,
    minimal: true,
    isActive: true,
  });
  const { data: subjectsData } = useSubjects();
  const { data: staffData } = useStaff();

  const classSections = classSectionsData?.data || [];
  const subjects = subjectsData?.data || [];
  const staffResponse = staffData as
    | {
        data?: Array<{
          id: string;
          fullName?: string | null;
          employeeId?: string | null;
          isActive: boolean;
          roles?: Array<{ roleName: string }>;
        }>;
      }
    | null
    | undefined;
  const staff = staffResponse?.data || [];

  const classSectionOptions = useMemo(() => {
    const unique = classSections.filter((cs, i, arr) => arr.findIndex((x) => x.id === cs.id) === i);
    return unique
      .sort((a, b) => {
        const classOrderA = a.classSortOrder ?? 999;
        const classOrderB = b.classSortOrder ?? 999;
        if (classOrderA !== classOrderB) return classOrderA - classOrderB;
        const sectionOrderA = a.sectionSortOrder ?? 999;
        const sectionOrderB = b.sectionSortOrder ?? 999;
        if (sectionOrderA !== sectionOrderB) return sectionOrderA - sectionOrderB;
        const sectionA = (a.sectionName || '').toLowerCase();
        const sectionB = (b.sectionName || '').toLowerCase();
        return sectionA.localeCompare(sectionB);
      })
      .map((cs) => ({
        value: cs.id,
        label: `${cs.classDisplayName ?? cs.className ?? t('unknown')} - ${cs.sectionName ?? t('unknown')}`,
      }));
  }, [classSections, t]);

  const subjectOptions = useMemo(
    () =>
      [...subjects]
        .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))
        .map((s) => ({ value: s.id, label: s.name })),
    [subjects],
  );

  const teacherOptions = useMemo(() => {
    return staff
      .filter((s) => {
        if (!s.isActive) return false;
        return s.roles?.some(
          (r) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher',
        );
      })
      .sort((a, b) => {
        const nameA = (a.fullName || a.employeeId || '').toLowerCase();
        const nameB = (b.fullName || b.employeeId || '').toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .map((s) => ({ value: s.id, label: s.fullName || s.employeeId || t('unknown') }));
  }, [staff, t]);

  const filteredAssignments = assignments.filter((assignment) => {
    if (selectedClassSectionIds.length > 0 && !selectedClassSectionIds.includes(assignment.classSectionId)) {
      return false;
    }
    if (selectedSubjectIds.length > 0 && !selectedSubjectIds.includes(assignment.subjectId)) {
      return false;
    }
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes(assignment.staffId)) {
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
      title: t('deleteAssignmentTitle'),
      children: (
        <Text size="sm">
          {t('deleteConfirm', {
            subjectName: assignment.subjectName ?? '',
            classSectionName: assignment.classSectionName ?? '',
          })}
        </Text>
      ),
      labels: { confirm: t('delete'), cancel: t('cancel') },
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
            <Group grow align="flex-start" wrap="wrap">
              <MultiSelect
                label={t('filterByClassSectionLabel')}
                placeholder={
                  selectedClassSectionIds.length === 0
                    ? t('allClassSections')
                    : t('classSectionsSelected', { count: selectedClassSectionIds.length })
                }
                description={t('filterByClassSectionListDescription')}
                data={classSectionOptions}
                value={selectedClassSectionIds}
                onChange={setSelectedClassSectionIds}
                clearable
                searchable
                style={{ minWidth: 220 }}
              />
              <MultiSelect
                label={t('showSubjectsLabel')}
                placeholder={
                  selectedSubjectIds.length === 0
                    ? t('allSubjects')
                    : t('subjectsSelected', { count: selectedSubjectIds.length })
                }
                description={t('showSubjectsDescription')}
                data={subjectOptions}
                value={selectedSubjectIds}
                onChange={setSelectedSubjectIds}
                clearable
                searchable
                style={{ minWidth: 220 }}
              />
              <MultiSelect
                label={t('filterByTeacherLabel')}
                placeholder={
                  selectedTeacherIds.length === 0
                    ? t('allTeachers')
                    : t('teachersFilterSelected', { count: selectedTeacherIds.length })
                }
                description={t('filterByTeachersListDescription')}
                data={teacherOptions}
                value={selectedTeacherIds}
                onChange={setSelectedTeacherIds}
                clearable
                searchable
                style={{ minWidth: 220 }}
              />
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('classSection')}</Table.Th>
                <Table.Th>{t('subject')}</Table.Th>
                <Table.Th>{t('teacher')}</Table.Th>
                <Table.Th>{t('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAssignments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center" py="xl">
                      {t('noAssignmentsFound')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <Table.Tr key={assignment.id}>
                    <Table.Td>{assignment.classSectionName || t('unknown')}</Table.Td>
                    <Table.Td>{assignment.subjectName || t('unknown')}</Table.Td>
                    <Table.Td>{assignment.staffName || t('unknown')}</Table.Td>
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

