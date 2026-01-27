'use client';

import { Modal, Select, Button, Stack, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAssignClassTeacher } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import { useStaff } from '@/hooks/useStaff';
import { useRoles } from '@/hooks/useRoles';

interface AssignClassTeacherModalProps {
  opened: boolean;
  onClose: () => void;
  classSection: ClassSection;
}

export function AssignClassTeacherModal({
  opened,
  onClose,
  classSection,
}: AssignClassTeacherModalProps) {
  const assignClassTeacher = useAssignClassTeacher();
  const { data: staffData } = useStaff();
  const { data: rolesData } = useRoles();

  const roles = rolesData?.data || [];
  const staffResponse = staffData;
  const staff = (staffResponse && 'data' in staffResponse ? staffResponse.data : []) as any[];

  // Find class_teacher role ID
  const classTeacherRole = roles.find((r) => r.name === 'class_teacher');
  const classTeacherRoleId = classTeacherRole?.id;

  // Filter staff by class_teacher role (if we have role assignments, filter by that)
  // For now, show all active staff - the backend will validate the role
  const availableStaff = staff.filter((s) => s.isActive);

  const form = useForm({
    initialValues: {
      staffId: classSection.classTeacherId || '',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    await assignClassTeacher.mutateAsync({
      id: classSection.id,
      input: {
        staffId: values.staffId || null,
      },
    });
    form.reset();
    onClose();
  };

  const staffOptions = [
    { value: '', label: 'None (Unassign)' },
    ...availableStaff.map((s) => ({
      value: s.id,
      label: s.fullName || s.employeeId || 'Unknown',
    })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Assign Class Teacher"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Class Teacher"
            placeholder="Select teacher"
            data={staffOptions}
            {...form.getInputProps('staffId')}
          />
          {classSection.classTeacherName && (
            <Text size="sm" c="dimmed">
              Current teacher: {classSection.classTeacherName}
            </Text>
          )}
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={assignClassTeacher.isPending}>
            {form.values.staffId ? 'Assign' : 'Unassign'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

