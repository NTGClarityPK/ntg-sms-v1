'use client';

import { useState } from 'react';
import { Button, Menu, Text } from '@mantine/core';
import { IconPlus, IconUser } from '@tabler/icons-react';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { useStaff } from '@/hooks/useStaff';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { CreateTeacherAssignmentInput } from '@/types/teacher-assignments';

interface MatrixCellProps {
  assignment?: TeacherAssignment;
  classSectionId: string;
  subjectId: string;
  onCreate: (input: CreateTeacherAssignmentInput) => Promise<TeacherAssignment>;
  onDelete: (id: string) => Promise<void>;
}

export function MatrixCell({
  assignment,
  classSectionId,
  subjectId,
  onCreate,
  onDelete,
}: MatrixCellProps) {
  const [opened, setOpened] = useState(false);
  const { data: staffData } = useStaff();
  const colors = useThemeColors();

  const staff = staffData?.data || [];
  const availableStaff = staff.filter((s) => s.isActive);

  const staffOptions = availableStaff.map((s) => ({
    value: s.id,
    label: s.fullName || s.employeeId || 'Unknown',
  }));

  const handleAssign = async (staffId: string) => {
    await onCreate({
      staffId,
      classSectionId,
      subjectId,
    });
    setOpened(false);
  };

  const handleUnassign = async () => {
    if (assignment) {
      await onDelete(assignment.id);
    }
    setOpened(false);
  };

  if (assignment) {
    return (
      <Menu opened={opened} onChange={setOpened}>
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
          {staffOptions.map((option) => (
            <Menu.Item
              key={option.value}
              onClick={() => handleAssign(option.value)}
              disabled={option.value === assignment.staffId}
            >
              {option.label}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item color="red" onClick={handleUnassign}>
            Unassign
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }

  return (
    <Menu opened={opened} onChange={setOpened}>
      <Menu.Target>
        <Button
          variant="subtle"
          size="xs"
          fullWidth
          leftSection={<IconPlus size={14} />}
        >
          Assign
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {staffOptions.length === 0 ? (
          <Menu.Item disabled>
            <Text size="sm" c="dimmed">
              No teachers available
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
  );
}

