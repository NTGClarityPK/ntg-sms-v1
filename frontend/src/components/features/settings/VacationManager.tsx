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

interface VacationFormValues {
  name: string;
  nameAr?: string;
  startDate: string;
  endDate: string;
}

export function VacationManager({ academicYearId }: { academicYearId?: string }) {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);

  const vacationsQuery = useVacations(academicYearId);
  const createMutation = useCreateVacation();
  const updateMutation = useUpdateVacation();
  const deleteMutation = useDeleteVacation();

  const form = useForm<VacationFormValues>({
    initialValues: { name: '', nameAr: '', startDate: '', endDate: '' },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      startDate: (v) => (v ? null : 'Start date is required'),
      endDate: (v, values) => {
        if (!v) return 'End date is required';
        if (values.startDate && v < values.startDate) return 'End date must be after start date';
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
        await updateMutation.mutateAsync({
          id: editingVacation.id,
          academicYearId,
          ...values,
        });
        notifications.show({
          title: 'Success',
          message: 'Vacation updated',
          color: notifyColors.success,
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          academicYearId,
        });
        notifications.show({
          title: 'Success',
          message: 'Vacation created',
          color: notifyColors.success,
        });
      }
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  });

  const handleDelete = async (vacation: Vacation) => {
    if (!confirm(`Delete "${vacation.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: vacation.id, academicYearId: vacation.academicYearId });
      notifications.show({
        title: 'Success',
        message: 'Vacation deleted',
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (!academicYearId) {
    return (
      <Alert color={colors.warning} title="No active academic year">
        Create and activate an academic year to manage vacations.
      </Alert>
    );
  }

  const vacations = vacationsQuery.data?.data ?? [];

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>Vacations</Text>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add vacation
          </Button>
        </Group>

        <Paper withBorder p="md">
          {vacations.length === 0 ? (
            <Text c="dimmed" size="sm">
              No vacations scheduled yet.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Start date</Table.Th>
                  <Table.Th>End date</Table.Th>
                  <Table.Th>Actions</Table.Th>
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
                          variant="subtle"
                          size="compact-sm"
                          leftSection={<IconPencil size={14} />}
                          onClick={() => openEdit(v)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => handleDelete(v)}
                          color={colors.error}
                        >
                          Delete
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

      <Modal opened={opened} onClose={close} title={editingVacation ? 'Edit vacation' : 'Add vacation'} size="md">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="Summer Vacation" {...form.getInputProps('name')} />
            <TextInput label="Name (Arabic)" placeholder="إجازة الصيف" {...form.getInputProps('nameAr')} />
            <TextInput label="Start date" type="date" {...form.getInputProps('startDate')} />
            <TextInput label="End date" type="date" {...form.getInputProps('endDate')} />
            
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={close}>Cancel</Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editingVacation ? 'Update' : 'Save'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

