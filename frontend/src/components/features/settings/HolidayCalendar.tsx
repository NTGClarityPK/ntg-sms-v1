'use client';

import { ActionIcon, Alert, Button, Group, Menu, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import type { PublicHoliday } from '@/types/settings';
import { useForm } from '@mantine/form';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface CreateHolidayValues {
  name: string;
  startDate: string;
  endDate: string;
}

interface HolidayCalendarProps {
  holidays: PublicHoliday[];
  academicYearId: string;
  onCreate: (values: CreateHolidayValues & { academicYearId: string }) => Promise<void>;
  onUpdate: (id: string, values: CreateHolidayValues & { academicYearId: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isCreating: boolean;
}

export function HolidayCalendar({ holidays, academicYearId, onCreate, onUpdate, onDelete, isCreating }: HolidayCalendarProps) {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<CreateHolidayValues>({
    initialValues: { name: '', startDate: '', endDate: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('scheduleHolidayNameRequired') : null),
      startDate: (v) => (!v ? tSettings('scheduleHolidayStartDateRequired') : null),
      endDate: (v, values) => {
        if (!v) return tSettings('scheduleHolidayEndDateRequired');
        if (values.startDate && values.startDate > v) return tSettings('scheduleHolidayEndDateAfterStart');
        return null;
      },
    },
    transformValues: (v) => ({ name: v.name.trim(), startDate: v.startDate, endDate: v.endDate }),
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset();
    open();
  };

  const openEdit = (holiday: PublicHoliday) => {
    setEditingId(holiday.id);
    form.setValues({
      name: holiday.name,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
    });
    open();
  };

  const submit = form.onSubmit(async (values) => {
    if (editingId) {
      await onUpdate(editingId, { ...values, academicYearId });
    } else {
      await onCreate({ ...values, academicYearId });
    }
    form.reset();
    setEditingId(null);
    close();
  });

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(tSettings('scheduleHolidayDeleteConfirm', { name }));
    if (!confirmed) return;
    await onDelete(id);
  };

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button id="holiday-calendar-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('scheduleHolidayAddButton')}
        </Button>
      </Group>

      <Paper withBorder p="md">
        {holidays.length === 0 ? (
          <Alert title={tSettings('scheduleHolidayNoDataTitle')}>
            <Text size="sm">{tSettings('scheduleHolidayNoDataText')}</Text>
          </Alert>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th>{tSettings('scheduleHolidayColStart')}</Table.Th>
                <Table.Th>{tSettings('scheduleHolidayColEnd')}</Table.Th>
                <Table.Th w={80}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {holidays.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>{h.name}</Table.Td>
                  <Table.Td>{h.startDate}</Table.Td>
                  <Table.Td>{h.endDate}</Table.Td>
                  <Table.Td>
                    <Menu withinPortal position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(h)}>
                          {tCommon('edit')}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color={colors.error}
                          onClick={() => handleDelete(h.id, h.name)}
                        >
                          {tCommon('delete')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={opened}
        onClose={close}
        title={editingId ? tSettings('scheduleHolidayModalEdit') : tSettings('scheduleHolidayModalAdd')}
        size="md"
      >
        <form id="holiday-form" onSubmit={submit}>
          <Stack gap="md">
            <TextInput
              id="holiday-form-name"
              label={tCommon('name')}
              placeholder={tSettings('scheduleHolidayNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            <Group grow>
              <TextInput
                id="holiday-form-start"
                label={tSettings('scheduleHolidayStartDateLabel')}
                type="date"
                {...form.getInputProps('startDate')}
              />
              <TextInput
                id="holiday-form-end"
                label={tSettings('scheduleHolidayEndDateLabel')}
                type="date"
                {...form.getInputProps('endDate')}
              />
            </Group>
            <Group justify="flex-end" mt="md">
              <Button id="holiday-form-cancel" variant="light" onClick={close} disabled={isCreating}>
                {tCommon('cancel')}
              </Button>
              <Button id="holiday-form-submit" type="submit" loading={isCreating}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
