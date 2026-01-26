'use client';

import { useState } from 'react';
import { Button, Menu, Text, Stack } from '@mantine/core';
import { IconPlus, IconUser, IconX } from '@tabler/icons-react';
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

export function MatrixCell({
  assignments,
  classSectionId,
  subjectId,
  onCreate,
  onDelete,
}: MatrixCellProps) {
  const [assignMenuOpened, setAssignMenuOpened] = useState(false);
  const [unassignMenuOpened, setUnassignMenuOpened] = useState<{ [key: string]: boolean }>({});
  const { data: staffData } = useStaff();

  const staff = staffData?.data || [];
  // Filter to only include active staff with teacher roles (class_teacher or subject_teacher)
  const availableStaff = staff.filter((s) => {
    if (!s.isActive) return false;
    // Check if staff has teacher roles
    const hasTeacherRole = s.roles?.some(
      (r) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher'
    );
    return hasTeacherRole;
  });

  // Get assigned staff IDs to filter them out from the assign menu
  const assignedStaffIds = new Set(assignments.map((a) => a.staffId));
  const availableForAssignment = availableStaff.filter((s) => !assignedStaffIds.has(s.id));

  const staffOptions = availableForAssignment.map((s) => ({
    value: s.id,
    label: s.fullName || s.employeeId || 'Unknown',
  }));

  const handleAssign = async (staffId: string) => {
    await onCreate({
      staffId,
      classSectionId,
      subjectId,
    });
    setAssignMenuOpened(false);
  };

  const handleUnassign = async (assignmentId: string) => {
    await onDelete(assignmentId);
    setUnassignMenuOpened((prev) => ({ ...prev, [assignmentId]: false }));
  };

  const handleUnassignMenuToggle = (assignmentId: string, opened: boolean) => {
    setUnassignMenuOpened((prev) => ({ ...prev, [assignmentId]: opened }));
  };

  return (
    <Stack gap={4}>
      {assignments.map((assignment) => (
        <Menu
          key={assignment.id}
          opened={unassignMenuOpened[assignment.id] || false}
          onChange={(opened) => handleUnassignMenuToggle(assignment.id, opened)}
        >
          <Menu.Target>
            <Button
              variant="light"
              size="xs"
              fullWidth
              leftSection={<IconUser size={14} />}
            >
              {assignment.staffName || 'Unknown'}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() => handleUnassign(assignment.id)}
            >
              Unassign
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ))}

      {/* Dotted "+ Assign" button - always visible to allow adding more teachers */}
      <Menu opened={assignMenuOpened} onChange={setAssignMenuOpened}>
        <Menu.Target>
          <Button
            variant="subtle"
            size="xs"
            fullWidth
            leftSection={<IconPlus size={14} />}
            style={{
              border: '1px dashed',
              borderColor: 'var(--mantine-color-gray-4)',
              backgroundColor: 'transparent',
            }}
          >
            Assign
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {staffOptions.length === 0 ? (
            <Menu.Item disabled>
              <Text size="sm" c="dimmed">
                {assignments.length > 0
                  ? 'All available teachers are already assigned'
                  : 'No teachers available'}
              </Text>
            </Menu.Item>
          ) : (
            staffOptions.map((option) => (
              <Menu.Item key={option.value} onClick={() => handleAssign(option.value)}>
                {option.label}
              </Menu.Item>
            ))
          )}
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
}
