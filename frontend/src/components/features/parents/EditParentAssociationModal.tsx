'use client';

import { useEffect } from 'react';
import { Modal, Button, Stack, Switch, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useUpdateParentAssociation } from '@/hooks/useParentAssociations';
import type { ParentAssociation } from '@/hooks/useParentAssociations';

interface EditParentAssociationModalProps {
  opened: boolean;
  onClose: () => void;
  association: ParentAssociation | null;
}

export function EditParentAssociationModal({
  opened,
  onClose,
  association,
}: EditParentAssociationModalProps) {
  const updateAssociation = useUpdateParentAssociation();

  const form = useForm({
    initialValues: {
      canApprove: true,
    },
  });

  // Update form when association changes
  useEffect(() => {
    if (association) {
      form.setFieldValue('canApprove', association.canApprove);
    }
  }, [association, form]);

  const handleSubmit = async (values: typeof form.values) => {
    if (!association) return;

    try {
      await updateAssociation.mutateAsync({
        parentUserId: association.parentUserId,
        studentId: association.studentId,
        input: { canApprove: values.canApprove },
      });
      form.reset();
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (!association) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit Parent-Student Association"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Parent: <strong>{association.parentName}</strong>
          </Text>
          <Text size="sm" c="dimmed">
            Student: <strong>{association.studentName}</strong> ({association.studentStudentId})
          </Text>

          <Switch
            label="Can approve requests"
            description="Allow this parent to approve child-related requests (e.g., leave requests, early departure, consent forms)"
            checked={form.values.canApprove}
            onChange={(e) => form.setFieldValue('canApprove', e.currentTarget.checked)}
            mt="md"
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={updateAssociation.isPending}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
