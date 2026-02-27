'use client';

import { Alert, ActionIcon, Button, Group, Skeleton, Modal, NumberInput, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil } from '@tabler/icons-react';
import { useClasses, useCreateClass, useUpdateClass } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { ClassEntity } from '@/types/settings';
import { useTranslations } from 'next-intl';

export function ClassList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [editClass, setEditClass] = useState<ClassEntity | null>(null);
  const listQuery = useClasses();
  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();

  const form = useForm<{ name: string; displayName: string; sortOrder: number }>({
    initialValues: { name: '', displayName: '', sortOrder: 0 },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('classNameRequired') : null),
      displayName: (v) => (v.trim().length === 0 ? tSettings('classDisplayNameRequired') : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), displayName: v.displayName.trim(), sortOrder: v.sortOrder }),
  });

  const openCreate = () => {
    setEditClass(null);
    form.setValues({ name: '', displayName: '', sortOrder: 0 });
    open();
  };

  const openEdit = (c: ClassEntity) => {
    setEditClass(c);
    form.setValues({ name: c.name, displayName: c.displayName, sortOrder: c.sortOrder });
    open();
  };

  const handleClose = () => {
    close();
    setEditClass(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      if (editClass) {
        await updateMutation.mutateAsync({
          id: editClass.id,
          payload: { name: values.name, displayName: values.displayName, sortOrder: values.sortOrder },
        });
        notifications.show({ title: tCommon('success'), message: tSettings('classUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: tCommon('success'), message: tSettings('classCreated'), color: notifyColors.success });
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
      <Alert color={colors.error} title={tSettings('classLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="class-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const classes = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button id="class-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('classAddButton')}
        </Button>
      </Group>

      <Paper withBorder p="md">
        {classes.length === 0 ? (
          <Text c="dimmed" size="sm">
            {tSettings('classNoData')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th>{tSettings('classColDisplayName')}</Table.Th>
                <Table.Th>{tSettings('classColSort')}</Table.Th>
                <Table.Th style={{ width: 80 }}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {classes.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>{c.displayName}</Table.Td>
                  <Table.Td>{c.sortOrder}</Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(c)} aria-label="Edit class">
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
        title={editClass ? tSettings('classModalEdit') : tSettings('classModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput id="class-form-name" label={tCommon('name')} placeholder="10" {...form.getInputProps('name')} />
            <TextInput
              id="class-form-display-name"
              label={tSettings('classDisplayNameLabel')}
              placeholder={tSettings('classDisplayNamePlaceholder')}
              {...form.getInputProps('displayName')}
            />
            <NumberInput id="class-form-sort-order" label={tSettings('classSortOrderLabel')} min={0} {...form.getInputProps('sortOrder')} />
            <Group justify="flex-end" mt="md">
              <Button id="class-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="class-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
