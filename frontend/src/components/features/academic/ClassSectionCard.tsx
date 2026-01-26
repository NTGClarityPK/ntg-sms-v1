'use client';

import { useState } from 'react';
import { Card, Group, Stack, Text, Badge, ActionIcon, Menu } from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconUsers,
  IconUser,
  IconDots,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import type { ClassSection } from '@/types/class-sections';
import { useDeleteClassSection } from '@/hooks/useClassSections';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useDisclosure } from '@mantine/hooks';
import { CreateClassSectionModal } from './CreateClassSectionModal';
import { ClassSectionStudentsModal } from './ClassSectionStudentsModal';
import { AssignClassTeacherModal } from './AssignClassTeacherModal';

interface ClassSectionCardProps {
  classSection: ClassSection;
  className: string;
  sectionName: string;
}

export function ClassSectionCard({
  classSection,
  className,
  sectionName,
}: ClassSectionCardProps) {
  const colors = useThemeColors();
  const deleteClassSection = useDeleteClassSection();
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [studentsOpened, { open: openStudents, close: closeStudents }] = useDisclosure(false);
  const [teacherOpened, { open: openTeacher, close: closeTeacher }] = useDisclosure(false);

  const statusColor = classSection.isActive ? colors.success : colors.info;
  const studentCount = classSection.studentCount ?? 0;
  const capacity = classSection.capacity;

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Delete Class Section',
      children: (
        <Text size="sm">
          Are you sure you want to delete {className} - {sectionName}? This action cannot be undone.
          {studentCount > 0 && (
            <Text c="red" size="sm" mt="xs">
              Warning: This class-section has {studentCount} enrolled student(s). You must remove
              all students before deleting.
            </Text>
          )}
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteClassSection.mutate(classSection.id);
      },
    });
  };

  return (
    <>
      <Card withBorder p="md">
        <Group justify="space-between" align="flex-start" mb="xs">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600}>
              {className} - {sectionName}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color={statusColor}>
                {classSection.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </Group>
          </Stack>
          <Menu>
            <Menu.Target>
              <ActionIcon variant="subtle">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={16} />} onClick={openEdit}>
                Edit
              </Menu.Item>
              <Menu.Item leftSection={<IconUsers size={16} />} onClick={openStudents}>
                View Students
              </Menu.Item>
              <Menu.Item leftSection={<IconUser size={16} />} onClick={openTeacher}>
                {classSection.classTeacherId ? 'Change Teacher' : 'Assign Teacher'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconTrash size={16} />}
                color="red"
                onClick={handleDelete}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Stack gap="xs" mt="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Students
            </Text>
            <Text size="sm" fw={500}>
              {studentCount} / {capacity}
            </Text>
          </Group>
          {classSection.classTeacherName && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Class Teacher
              </Text>
              <Text size="sm" fw={500}>
                {classSection.classTeacherName}
              </Text>
            </Group>
          )}
        </Stack>
      </Card>

      <CreateClassSectionModal
        opened={editOpened}
        onClose={closeEdit}
        classSection={classSection}
      />
      <ClassSectionStudentsModal
        opened={studentsOpened}
        onClose={closeStudents}
        classSectionId={classSection.id}
      />
      <AssignClassTeacherModal
        opened={teacherOpened}
        onClose={closeTeacher}
        classSection={classSection}
      />
    </>
  );
}

