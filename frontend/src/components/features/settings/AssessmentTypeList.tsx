'use client';

import { Alert, ActionIcon, Button, Group, Skeleton, Modal, Paper, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil } from '@tabler/icons-react';
import { useCreateAssessmentType, useAssessmentTypes, useUpdateAssessmentType } from '@/hooks/useAssessmentSettings';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { AssessmentType } from '@/types/settings';
import { TranslatableInput, type TranslatableValue } from '@/components/common/TranslatableInput';

const emptyTranslations: TranslatableValue = { en: '', ar: '' };

export function AssessmentTypeList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [editType, setEditType] = useState<AssessmentType | null>(null);
  const listQuery = useAssessmentTypes();
  const createMutation = useCreateAssessmentType();
  const updateMutation = useUpdateAssessmentType();

  const form = useForm<{ nameTranslations: TranslatableValue }>({
    initialValues: { nameTranslations: { ...emptyTranslations } },
    validate: {
      nameTranslations: (v) =>
        (!(v.en ?? '').trim() && !(v.ar ?? '').trim()) ? 'Name (EN or AR) is required' : null,
    },
    transformValues: (v) => ({
      nameTranslations: { en: (v.nameTranslations.en ?? '').trim(), ar: (v.nameTranslations.ar ?? '').trim() },
    }),
  });

  const openCreate = () => {
    setEditType(null);
    form.setValues({ nameTranslations: { ...emptyTranslations } });
    open();
  };

  const openEdit = (t: AssessmentType) => {
    setEditType(t);
    form.setValues({ nameTranslations: { en: t.name ?? '', ar: t.name ?? '' } });
    open();
  };

  const handleClose = () => {
    close();
    setEditType(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    const name = values.nameTranslations.en || values.nameTranslations.ar || '';
    const payload = { name, name_translations: values.nameTranslations };
    try {
      if (editType) {
        await updateMutation.mutateAsync({ id: editType.id, ...payload });
        notifications.show({ title: 'Success', message: 'Assessment type updated', color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(payload);
        notifications.show({ title: 'Success', message: 'Assessment type created', color: notifyColors.success });
      }
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  });

  if (listQuery.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={50} />
      </Stack>
    );
  }

  if (listQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load assessment types">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button id="assessment-type-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  const types = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="lg" fw={500}>Assessment Types</Text>
        <Button id="assessment-type-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add type
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Assessment types categorise different forms of evaluation such as quizzes, assignments, exams, and projects. 
        These types help organise and track student performance across various assessment methods throughout the academic year.
      </Text>

      <Paper withBorder p="md">
        {types.length === 0 ? (
          <Text c="dimmed" size="sm">
            No assessment types yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th w={80}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {types.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" size="sm" aria-label="Edit" onClick={() => openEdit(t)}>
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={opened}
        onClose={handleClose}
        title={editType ? 'Edit assessment type' : 'Add assessment type'}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TranslatableInput
              id="assessment-type-form-name"
              label="Name"
              value={form.values.nameTranslations}
              onChange={(v) => form.setFieldValue('nameTranslations', v)}
              required
              placeholder={{ en: 'Quiz', ar: 'اختبار قصير' }}
            />
            <Group justify="flex-end" mt="md">
              <Button id="assessment-type-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancel
              </Button>
              <Button id="assessment-type-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}


