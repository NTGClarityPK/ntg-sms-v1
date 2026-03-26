'use client';

import { Alert, ActionIcon, Button, Group, Skeleton, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil } from '@tabler/icons-react';
import { useCreateSection, useSections, useUpdateSection } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { Section } from '@/types/settings';
import { useTranslations } from 'next-intl';

export function SectionList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const listQuery = useSections();
  const createMutation = useCreateSection();
  const updateMutation = useUpdateSection();

  const form = useForm<{ name: string }>({
    initialValues: { name: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('sectionNameRequired') : null),
    },
    transformValues: (v) => ({ name: v.name.trim() }),
  });

  const openCreate = () => {
    setEditSection(null);
    form.setValues({ name: '' });
    open();
  };

  const openEdit = (s: Section) => {
    setEditSection(s);
    form.setValues({ name: s.name });
    open();
  };

  const handleClose = () => {
    close();
    setEditSection(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      if (editSection) {
        await updateMutation.mutateAsync({ id: editSection.id, payload: { name: values.name } });
        notifications.show({ title: tCommon('success'), message: tSettings('sectionUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: tCommon('success'), message: tSettings('sectionCreated'), color: notifyColors.success });
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
      <Alert color={colors.error} title={tSettings('sectionLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="section-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const sections = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button id="section-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('sectionAddButton')}
        </Button>
      </Group>

      <Paper withBorder p="md">
        {sections.length === 0 ? (
          <Text c="dimmed" size="sm">
            {tSettings('sectionNoData')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th style={{ width: 80 }}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sections.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(s)} aria-label="Edit section">
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
        title={editSection ? tSettings('sectionModalEdit') : tSettings('sectionModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput
              id="section-form-name"
              label={tSettings('sectionFormNameLabel')}
              placeholder={tSettings('sectionFormNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            <Group justify="flex-end" mt="md">
              <Button id="section-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="section-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
