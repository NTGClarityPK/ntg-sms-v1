'use client';

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Menu, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { useStaff } from '@/hooks/useStaff';
import type { CreateTeacherAssignmentInput } from '@/types/teacher-assignments';

interface MatrixCellProps {
  assignments: TeacherAssignment[];
  classSectionId: string;
  subjectId: string;
  onCreate: (input: CreateTeacherAssignmentInput) => Promise<TeacherAssignment>;
  onDelete: (id: string) => Promise<void>;
}

function AssignMenuContent({
  staffOptions,
  onAssign,
  emptyMessage,
}: {
  staffOptions: { value: string; label: string }[];
  onAssign: (staffId: string) => void;
  emptyMessage: string;
}) {
  return staffOptions.length === 0 ? (
    <Menu.Item disabled>
      <Text size="sm" c="dimmed">
        {emptyMessage}
      </Text>
    </Menu.Item>
  ) : (
    <>
      {staffOptions.map((option) => (
        <Menu.Item key={option.value} onClick={() => onAssign(option.value)}>
          {option.label}
        </Menu.Item>
      ))}
    </>
  );
}

function TeacherBadge({
  assignment,
  onUnassign,
}: {
  assignment: TeacherAssignment;
  onUnassign: (id: string) => void;
}) {
  const t = useTranslations('teacher');
  const [hovered, setHovered] = useState(false);

  return (
    <Group
      gap={2}
      wrap="nowrap"
      align="center"
      style={{ cursor: 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Badge
        size="sm"
        variant="light"
        style={{
          backgroundColor: 'var(--theme-matrix-teacher-badge-bg, var(--mantine-color-blue-1))',
          color: 'var(--theme-matrix-teacher-badge-text, var(--mantine-color-blue-8))',
        }}
      >
        {assignment.staffName || t('unknown')}
      </Badge>
      <Tooltip label={t('remove')} withArrow>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="red"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }}
          onClick={(e) => {
            e.stopPropagation();
            onUnassign(assignment.id);
          }}
          aria-label={t('removeTeacherAria')}
        >
          <IconX size={12} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

export function MatrixCell({
  assignments,
  classSectionId,
  subjectId,
  onCreate,
  onDelete,
}: MatrixCellProps) {
  const t = useTranslations('teacher');
  const [assignMenuOpened, setAssignMenuOpened] = useState(false);
  const { data: staffData } = useStaff();

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
  const availableStaff = staff.filter((s) => {
    if (!s.isActive) return false;
    const hasTeacherRole = s.roles?.some(
      (r: { roleName: string }) =>
        r.roleName === 'class_teacher' || r.roleName === 'subject_teacher'
    );
    return hasTeacherRole;
  });

  const assignedStaffIds = new Set(assignments.map((a) => a.staffId));
  const availableForAssignment = availableStaff.filter((s) => !assignedStaffIds.has(s.id));
  // Sort teachers alphabetically by full name
  const sortedAvailableStaff = availableForAssignment.sort((a, b) => {
    const nameA = (a.fullName || a.employeeId || 'Unknown').toLowerCase();
    const nameB = (b.fullName || b.employeeId || 'Unknown').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  const staffOptions = sortedAvailableStaff.map((s) => ({
    value: s.id,
    label: s.fullName || s.employeeId || t('unknown'),
  }));

  const handleAssign = async (staffId: string) => {
    await onCreate({ staffId, classSectionId, subjectId });
    setAssignMenuOpened(false);
  };

  const assignMenuDropdown = (
    <Menu.Dropdown>
      <AssignMenuContent
        staffOptions={staffOptions}
        onAssign={handleAssign}
        emptyMessage={
          assignments.length > 0 ? t('allTeachersAssigned') : t('noTeachersAvailable')
        }
      />
    </Menu.Dropdown>
  );

  // Empty slot: small green "+" icon only
  if (assignments.length === 0) {
    return (
      <Menu opened={assignMenuOpened} onChange={setAssignMenuOpened}>
        <Menu.Target>
          <Tooltip label={t('assignTeacher')} withArrow>
            <Button
              variant="light"
              size="xs"
              px={6}
              data-matrix-assign-button
            >
              <IconPlus size={14} />
            </Button>
          </Tooltip>
        </Menu.Target>
        {assignMenuDropdown}
      </Menu>
    );
  }

  // Has teacher(s): [Badge1] ... [+][LastBadge] — small green + before the latest teacher
  const teachersBeforeLast = assignments.slice(0, -1);
  const lastTeacher = assignments[assignments.length - 1];

  return (
    <Group gap={4} wrap="nowrap" align="center">
      {teachersBeforeLast.map((assignment) => (
        <TeacherBadge key={assignment.id} assignment={assignment} onUnassign={onDelete} />
      ))}
      <Menu opened={assignMenuOpened} onChange={setAssignMenuOpened}>
        <Menu.Target>
          <Tooltip label={t('assignTeacher')} withArrow>
            <Button
              variant="light"
              size="xs"
              px={6}
              data-matrix-assign-button
            >
              <IconPlus size={14} />
            </Button>
          </Tooltip>
        </Menu.Target>
        {assignMenuDropdown}
      </Menu>
      <TeacherBadge assignment={lastTeacher} onUnassign={onDelete} />
    </Group>
  );
}
