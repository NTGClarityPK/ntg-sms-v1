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
import { useTranslations } from 'next-intl';

const emptyTranslations: TranslatableValue = { en: '', ar: '' };

export function AssessmentTypeList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [editType, setEditType] = useState<AssessmentType | null>(null);
  const listQuery = useAssessmentTypes();
  const createMutation = useCreateAssessmentType();
  const updateMutation = useUpdateAssessmentType();

  const form = useForm<{ nameTranslations: TranslatableValue }>({
    initialValues: { nameTranslations: { ...emptyTranslations } },
    validate: {
      nameTranslations: (v) =>
        (!(v.en ?? '').trim() && !(v.ar ?? '').trim()) ? tSettings('assessmentTypeNameRequired') : null,
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
        notifications.show({ title: tCommon('success'), message: tSettings('assessmentTypeUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(payload);
        notifications.show({ title: tCommon('success'), message: tSettings('assessmentTypeCreated'), color: notifyColors.success });
      }
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
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
      <Alert color={colors.error} title={tSettings('assessmentTypeLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="assessment-type-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const types = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="lg" fw={500}>{tSettings('assessmentTypeListTitle')}</Text>
        <Button id="assessment-type-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('assessmentTypeAddButton')}
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {tSettings('assessmentTypeDescription')}
      </Text>

      <Paper withBorder p="md">
        {types.length === 0 ? (
          <Text c="dimmed" size="sm">{tSettings('assessmentTypeNoData')}</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th w={80}>{tCommon('actions')}</Table.Th>
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
        title={editType ? tSettings('assessmentTypeModalEdit') : tSettings('assessmentTypeModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TranslatableInput
              id="assessment-type-form-name"
              label={tSettings('assessmentTypeFormNameLabel')}
              description={tSettings('assessmentTypeFormNameDescription')}
              value={form.values.nameTranslations}
              onChange={(v) => form.setFieldValue('nameTranslations', v)}
              required
              placeholder={{
                en: tSettings('assessmentTypeFormNamePlaceholderEn'),
                ar: tSettings('assessmentTypeFormNamePlaceholderAr'),
              }}
            />
            <Group justify="flex-end" mt="md">
              <Button id="assessment-type-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="assessment-type-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
