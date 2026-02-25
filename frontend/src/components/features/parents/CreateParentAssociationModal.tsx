'use client';

import { Modal, Button, Stack, Select, Group, Text, Alert, Badge, Switch } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useCreateParentAssociation, useParentAssociations } from '@/hooks/useParentAssociations';
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
  const students = (studentsData as { data?: Array<{ id: string; firstName?: string | null; lastName?: string | null; studentId: string }> } | null | undefined)?.data || [];

  // Check current guardian count for selected student
  const { data: existingAssociations } = useParentAssociations({
    studentId: form.values.studentId || undefined,
    limit: 100,
  });

  const currentGuardianCount = useMemo(() => {
    if (!form.values.studentId || !existingAssociations?.data) return 0;
    return existingAssociations.data.filter((a) => a.studentId === form.values.studentId).length;
  }, [form.values.studentId, existingAssociations]);

  const willBePriority = useMemo(() => {
    if (currentGuardianCount === 0) return 1; // First guardian = Primary
    if (currentGuardianCount === 1) return 2; // Second guardian = Secondary
    return null; // Max reached
  }, [currentGuardianCount]);

  const canCreate = currentGuardianCount < 2;

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
      <form id="create-parent-association-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            id="create-parent-association-parent"
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
            id="create-parent-association-student"
            label="Student"
            placeholder="Select a student"
            data={students.map((s) => ({
              value: s.id,
              label: `${`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'N/A'} (${s.studentId})`,
            }))}
            searchable
            required
            {...form.getInputProps('studentId')}
          />

          <Select
            id="create-parent-association-relationship"
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

          {/* Show guardian count and priority info */}
          {form.values.studentId && (
            <Alert
              color={canCreate ? 'blue' : 'yellow'}
              title={
                canCreate
                  ? `Will be set as ${willBePriority === 1 ? 'Primary' : 'Secondary'} Guardian (Priority ${willBePriority})`
                  : 'Maximum 2 guardians reached'
              }
            >
              <Text size="sm">
                {canCreate
                  ? `This student currently has ${currentGuardianCount} guardian(s). This will be the ${willBePriority === 1 ? 'primary' : 'secondary'} contact.`
                  : 'This student already has 2 guardians. Please remove one before adding another.'}
              </Text>
            </Alert>
          )}

          <Switch
            id="create-parent-association-can-approve"
            label="Can approve requests"
            description="Allow this parent to approve child-related requests (e.g., leave requests, early departure, consent forms)"
            checked={form.values.canApprove}
            onChange={(e) => form.setFieldValue('canApprove', e.currentTarget.checked)}
            mt="md"
          />

          <Group justify="flex-end" mt="md">
            <Button id="create-parent-association-cancel" variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button id="create-parent-association-submit" type="submit" loading={createAssociation.isPending} disabled={!canCreate}>
              Create Association
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

