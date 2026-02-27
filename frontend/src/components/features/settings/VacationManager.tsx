'use client';

import { Alert, Button, Group, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash, IconPencil } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useCreateVacation, useDeleteVacation, useUpdateVacation, useVacations } from '@/hooks/useScheduleSettings';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import type { Vacation } from '@/types/settings';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface VacationFormValues {
  name: string;
  nameAr?: string;
  startDate: string;
  endDate: string;
}

export function VacationManager({ academicYearId }: { academicYearId?: string }) {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);

  const vacationsQuery = useVacations(academicYearId);
  const createMutation = useCreateVacation();
  const updateMutation = useUpdateVacation();
  const deleteMutation = useDeleteVacation();

  const form = useForm<VacationFormValues>({
    initialValues: { name: '', nameAr: '', startDate: '', endDate: '' },
    validate: {
      name: (v) => (v.trim() ? null : tSettings('scheduleVacationsNameRequired')),
      startDate: (v) => (v ? null : tSettings('scheduleVacationsStartDateRequired')),
      endDate: (v, values) => {
        if (!v) return tSettings('scheduleVacationsEndDateRequired');
        if (values.startDate && v < values.startDate) return tSettings('scheduleVacationsEndDateAfterStart');
        return null;
      },
    },
  });

  const openCreate = () => {
    setEditingVacation(null);
    form.reset();
    open();
  };

  const openEdit = (vacation: Vacation) => {
    setEditingVacation(vacation);
    form.setValues({
      name: vacation.name,
      nameAr: vacation.nameAr ?? '',
      startDate: vacation.startDate,
      endDate: vacation.endDate,
    });
    open();
  };

  const handleSubmit = form.onSubmit(async (values) => {
    if (!academicYearId) return;
    try {
      if (editingVacation) {
        await updateMutation.mutateAsync({ id: editingVacation.id, academicYearId, ...values });
        notifications.show({ title: tCommon('success'), message: tSettings('scheduleVacationUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync({ ...values, academicYearId });
        notifications.show({ title: tCommon('success'), message: tSettings('scheduleVacationCreated'), color: notifyColors.success });
      }
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  });

  const handleDelete = async (vacation: Vacation) => {
    if (!confirm(tSettings('scheduleVacationsDeleteConfirm', { name: vacation.name }))) return;
    try {
      await deleteMutation.mutateAsync({ id: vacation.id, academicYearId: vacation.academicYearId });
      notifications.show({ title: tCommon('success'), message: tSettings('scheduleVacationDeleted'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  if (!academicYearId) {
    return (
      <Alert color={colors.warning} title={tSettings('scheduleNoActiveYearTitle')}>
        {tSettings('scheduleVacationsNoActiveYearMessage')}
      </Alert>
    );
  }

  const vacations = vacationsQuery.data?.data ?? [];

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>{tSettings('scheduleVacationsTitle')}</Text>
          <Button id="vacation-manager-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            {tSettings('scheduleVacationsAddButton')}
          </Button>
        </Group>

        <Paper withBorder p="md">
          {vacations.length === 0 ? (
            <Text c="dimmed" size="sm">
              {tSettings('scheduleVacationsNoData')}
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{tCommon('name')}</Table.Th>
                  <Table.Th>{tSettings('scheduleVacationsColStartDate')}</Table.Th>
                  <Table.Th>{tSettings('scheduleVacationsColEndDate')}</Table.Th>
                  <Table.Th>{tCommon('actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vacations.map((v) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>{v.name}</Table.Td>
                    <Table.Td>{v.startDate}</Table.Td>
                    <Table.Td>{v.endDate}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          id={`vacation-row-${v.id}-edit`}
                          variant="subtle"
                          size="compact-sm"
                          leftSection={<IconPencil size={14} />}
                          onClick={() => openEdit(v)}
                        >
                          {tCommon('edit')}
                        </Button>
                        <Button
                          id={`vacation-row-${v.id}-delete`}
                          variant="subtle"
                          size="compact-sm"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => handleDelete(v)}
                          color={colors.error}
                        >
                          {tCommon('delete')}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      <Modal
        opened={opened}
        onClose={close}
        title={editingVacation ? tSettings('scheduleVacationsModalEdit') : tSettings('scheduleVacationsModalAdd')}
        size="md"
      >
        <form id="vacation-form" onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              id="vacation-form-name"
              label={tCommon('name')}
              placeholder={tSettings('scheduleVacationsNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            <TextInput
              id="vacation-form-name-ar"
              label={tSettings('scheduleVacationsNameArLabel')}
              placeholder="إجازة الصيف"
              {...form.getInputProps('nameAr')}
            />
            <TextInput
              id="vacation-form-start"
              label={tSettings('scheduleVacationsColStartDate')}
              type="date"
              {...form.getInputProps('startDate')}
            />
            <TextInput
              id="vacation-form-end"
              label={tSettings('scheduleVacationsColEndDate')}
              type="date"
              {...form.getInputProps('endDate')}
            />
            <Group justify="flex-end" mt="md">
              <Button id="vacation-form-cancel" variant="light" onClick={close}>
                {tCommon('cancel')}
              </Button>
              <Button id="vacation-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editingVacation ? tCommon('update') : tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
