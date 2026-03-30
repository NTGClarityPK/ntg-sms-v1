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
import { useTranslations } from 'next-intl';
import type { ClassSection } from '@/types/class-sections';
import { useDeleteClassSection } from '@/hooks/useClassSections';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useDisclosure } from '@mantine/hooks';
import { CreateClassSectionModal } from './CreateClassSectionModal';
import { ClassSectionStudentsModal } from './ClassSectionStudentsModal';
import { AssignClassTeacherModal } from './AssignClassTeacherModal';
import { useFeaturePermission } from '@/hooks/usePermissions';

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
  const t = useTranslations('class');
  const colors = useThemeColors();
  const { canEdit } = useFeaturePermission('class_sections');
  const deleteClassSection = useDeleteClassSection();
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [studentsOpened, { open: openStudents, close: closeStudents }] = useDisclosure(false);
  const [teacherOpened, { open: openTeacher, close: closeTeacher }] = useDisclosure(false);

  const statusColor = classSection.isActive ? colors.success : colors.statusInactive.badgeColor;
  const studentCount = classSection.studentCount ?? 0;
  const capacity = classSection.capacity;

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('deleteClassSection'),
      children: (
        <Text size="sm">
          {t('deleteConfirm', { className, sectionName })}
          {studentCount > 0 && (
            <Text c="red" size="sm" mt="xs">
              {t('warningStudentsEnrolled', { count: studentCount })}
            </Text>
          )}
        </Text>
      ),
      labels: { confirm: t('delete'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteClassSection.mutate(classSection.id);
      },
    });
  };

  return (
    <>
      <Card
        withBorder
        p="md"
        style={
          !classSection.isActive
            ? {
                backgroundColor: colors.statusInactive.cardBackground,
                borderColor: colors.statusInactive.cardBorder,
              }
            : undefined
        }
      >
        <Group justify="space-between" align="flex-start" mb="xs">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600}>
              {className} - {sectionName}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color={statusColor}>
                {classSection.isActive ? t('active') : t('inactive')}
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
              {canEdit && (
                <Menu.Item leftSection={<IconEdit size={16} />} onClick={openEdit}>
                  {t('edit')}
                </Menu.Item>
              )}
              <Menu.Item leftSection={<IconUsers size={16} />} onClick={openStudents}>
                {t('viewStudents')}
              </Menu.Item>
              {canEdit && (
                <>
                  <Menu.Item leftSection={<IconUser size={16} />} onClick={openTeacher}>
                    {classSection.classTeacherId ? t('changeTeacher') : t('assignTeacher')}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTrash size={16} />}
                    color="red"
                    onClick={handleDelete}
                  >
                    {t('delete')}
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Stack gap="xs" mt="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('students')}
            </Text>
            <Text size="sm" fw={500}>
              {studentCount} / {capacity}
            </Text>
          </Group>
          {classSection.classTeacherName && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {t('classTeacher')}
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

