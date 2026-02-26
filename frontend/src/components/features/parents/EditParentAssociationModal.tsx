'use client';

import { useEffect } from 'react';
import { Modal, Button, Stack, Switch, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('user');
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
      title={t('editParentAssociationTitle')}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('parentLabel')}: <strong>{association.parentName}</strong>
          </Text>
          <Text size="sm" c="dimmed">
            {t('studentLabel')}: <strong>{association.studentName}</strong> ({association.studentStudentId})
          </Text>

          <Switch
            label={t('canApproveRequests')}
            description={t('canApproveRequestsDescription')}
            checked={form.values.canApprove}
            onChange={(e) => form.setFieldValue('canApprove', e.currentTarget.checked)}
            mt="md"
          />

          <Group justify="flex-end" mt="md">
            <Button id="edit-parent-association-cancel" variant="subtle" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button id="edit-parent-association-submit" type="submit" loading={updateAssociation.isPending}>
              {t('saveChanges')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
