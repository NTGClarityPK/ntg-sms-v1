'use client';

import { Modal, Button, Stack, Select, Group, Text, Alert, Badge, Switch } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('user');
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
      parentUserId: (value) => (!value ? t('parentRequired') : null),
      studentId: (value) => (!value ? t('studentRequired') : null),
      relationship: (value) => (!value ? t('relationshipRequired') : null),
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
      title={t('createParentAssociationTitle')}
      size="md"
    >
      <form id="create-parent-association-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            id="create-parent-association-parent"
            label={t('parentLabel')}
            placeholder={t('selectParent')}
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
            label={t('studentLabel')}
            placeholder={t('selectStudent')}
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
            label={t('relationship')}
            placeholder={t('selectRelationship')}
            data={[
              { value: 'father', label: t('father') },
              { value: 'mother', label: t('mother') },
              { value: 'guardian', label: t('guardian') },
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
                  ? willBePriority === 1 ? t('willBePrimaryGuardian') : t('willBeSecondaryGuardian')
                  : t('maxGuardiansReached')
              }
            >
              <Text size="sm">
                {canCreate
                  ? t('currentGuardiansInfo', {
                      count: currentGuardianCount,
                      primaryOrSecondary: willBePriority === 1 ? t('primaryContact') : t('secondaryContact'),
                    })
                  : t('maxGuardiansInfo')}
              </Text>
            </Alert>
          )}

          <Switch
            id="create-parent-association-can-approve"
            label={t('canApproveRequests')}
            description={t('canApproveRequestsDescription')}
            checked={form.values.canApprove}
            onChange={(e) => form.setFieldValue('canApprove', e.currentTarget.checked)}
            mt="md"
          />

          <Group justify="flex-end" mt="md">
            <Button id="create-parent-association-cancel" variant="subtle" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button id="create-parent-association-submit" type="submit" loading={createAssociation.isPending} disabled={!canCreate}>
              {t('createAssociation')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

