'use client';

import { Alert, ActionIcon, Button, Group, Skeleton, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil } from '@tabler/icons-react';
import { useCreateSubject, useSubjects, useUpdateSubject } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { Subject } from '@/types/settings';
import { TranslatableInput, type TranslatableValue } from '@/components/common/TranslatableInput';
import { useTranslations } from 'next-intl';

const emptyTranslations: TranslatableValue = { en: '', ar: '' };

export function SubjectList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const listQuery = useSubjects();
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();

  const form = useForm<{ nameTranslations: TranslatableValue; code: string }>({
    initialValues: { nameTranslations: { ...emptyTranslations }, code: '' },
    validate: {
      nameTranslations: (v) =>
        (!(v.en ?? '').trim() && !(v.ar ?? '').trim()) ? tSettings('subjectNameRequired') : null,
    },
    transformValues: (v) => ({
      nameTranslations: { en: (v.nameTranslations.en ?? '').trim(), ar: (v.nameTranslations.ar ?? '').trim() },
      code: v.code.trim(),
    }),
  });

  const openCreate = () => {
    setEditSubject(null);
    form.setValues({ nameTranslations: { ...emptyTranslations }, code: '' });
    open();
  };

  const openEdit = (s: Subject) => {
    setEditSubject(s);
    form.setValues({
      nameTranslations: { en: s.name ?? '', ar: s.name ?? '' },
      code: s.code ?? '',
    });
    open();
  };

  const handleClose = () => {
    close();
    setEditSubject(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    const name = values.nameTranslations.en || values.nameTranslations.ar || '';
    const payload = {
      name,
      name_translations: values.nameTranslations,
      code: values.code || undefined,
    };
    try {
      if (editSubject) {
        await updateMutation.mutateAsync({
          id: editSubject.id,
          payload: { ...payload, nameAr: values.nameTranslations.ar || undefined },
        });
        notifications.show({ title: tCommon('success'), message: tSettings('subjectUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(payload);
        notifications.show({ title: tCommon('success'), message: tSettings('subjectCreated'), color: notifyColors.success });
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
      <Alert color={colors.error} title={tSettings('subjectLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="subject-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const subjects = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button id="subject-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('subjectAddButton')}
        </Button>
      </Group>

      <Paper withBorder p="md">
        {subjects.length === 0 ? (
          <Text c="dimmed" size="sm">
            {tSettings('subjectNoData')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th>{tSettings('subjectColCode')}</Table.Th>
                <Table.Th style={{ width: 80 }}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {subjects.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td>{s.code ?? '-'}</Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(s)} aria-label="Edit subject">
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
        title={editSubject ? tSettings('subjectModalEdit') : tSettings('subjectModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TranslatableInput
              id="subject-form-name"
              label={tSettings('subjectFormNameLabel')}
              description={tSettings('subjectFormNameDescription')}
              value={form.values.nameTranslations}
              onChange={(v) => form.setFieldValue('nameTranslations', v)}
              required
              placeholder={{
                en: tSettings('subjectFormNamePlaceholderEn'),
                ar: tSettings('subjectFormNamePlaceholderAr'),
              }}
            />
            <TextInput
              id="subject-form-code"
              label={tSettings('subjectColCode')}
              description={tSettings('subjectFormCodeDescription')}
              placeholder={tSettings('subjectFormCodePlaceholder')}
              {...form.getInputProps('code')}
            />
            <Group justify="flex-end" mt="md">
              <Button id="subject-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="subject-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
