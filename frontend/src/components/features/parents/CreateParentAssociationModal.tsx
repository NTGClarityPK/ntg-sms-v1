'use client';

import { Modal, Button, Stack, Select, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useCreateParentAssociation } from '@/hooks/useParentAssociations';
import { useUsers } from '@/hooks/useUsers';
import { useStudents } from '@/hooks/useStudents';
import { useRoles } from '@/hooks/useRoles';
import { useMemo } from 'react';

interface CreateParentAssociationModalProps {
  opened: boolean;
  onClose: () => void;
}

export function CreateParentAssociationModal({
  opened,
  onClose,
}: CreateParentAssociationModalProps) {
  const createAssociation = useCreateParentAssociation();

  const form = useForm({
    initialValues: {
      parentUserId: '',
      studentId: '',
      relationship: 'guardian' as 'father' | 'mother' | 'guardian',
      isPrimary: false,
      canApprove: true,
    },
    validate: {
      parentUserId: (value) => (!value ? 'Parent is required' : null),
      studentId: (value) => (!value ? 'Student is required' : null),
      relationship: (value) => (!value ? 'Relationship is required' : null),
    },
  });

  // Fetch roles to get parent role ID
  const { data: rolesData } = useRoles();
  const parentRoleId = useMemo(() => {
    if (!rolesData?.data) return undefined;
    const parentRole = rolesData.data.find((r) => r.name === 'parent');
    return parentRole?.id;
  }, [rolesData]);

  // Fetch parents (users with parent role)
  const { data: usersData } = useUsers({
    roles: parentRoleId ? [parentRoleId] : undefined,
  });
  // Backend caps limit at 100 via DTO validation
  const { data: studentsData } = useStudents({ page: 1, limit: 100 });

  const parents = usersData?.data || [];
  const students = (studentsData as { data?: Array<{ id: string; fullName?: string | null; studentId: string }> } | null | undefined)?.data || [];

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await createAssociation.mutateAsync({
        parentUserId: values.parentUserId,
        studentId: values.studentId,
        relationship: values.relationship,
        isPrimary: values.isPrimary,
        canApprove: values.canApprove,
      });
      form.reset();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Parent-Student Association"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Parent"
            placeholder="Select a parent"
            data={parents.map((p) => ({
              value: p.id,
              label: `${p.fullName}${p.email ? ` (${p.email})` : ''}`,
            }))}
            searchable
            required
            {...form.getInputProps('parentUserId')}
          />

          <Select
            label="Student"
            placeholder="Select a student"
            data={students.map((s) => ({
              value: s.id,
              label: `${s.fullName || 'N/A'} (${s.studentId})`,
            }))}
            searchable
            required
            {...form.getInputProps('studentId')}
          />

          <Select
            label="Relationship"
            placeholder="Select relationship"
            data={[
              { value: 'father', label: 'Father' },
              { value: 'mother', label: 'Mother' },
              { value: 'guardian', label: 'Guardian' },
            ]}
            required
            {...form.getInputProps('relationship')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createAssociation.isPending}>
              Create Association
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

