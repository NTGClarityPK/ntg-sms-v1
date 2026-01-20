'use client';

import { Alert, Button, Group, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import type { PublicHoliday } from '@/types/settings';
import { useForm } from '@mantine/form';

export interface CreateHolidayValues {
  name: string;
  startDate: string;
  endDate: string;
}

interface HolidayCalendarProps {
  holidays: PublicHoliday[];
  academicYearId: string;
  onCreate: (values: CreateHolidayValues & { academicYearId: string }) => Promise<void>;
  isCreating: boolean;
}

export function HolidayCalendar({ holidays, academicYearId, onCreate, isCreating }: HolidayCalendarProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const form = useForm<CreateHolidayValues>({
    initialValues: { name: '', startDate: '', endDate: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      startDate: (v) => (!v ? 'Start date is required' : null),
      endDate: (v, values) => {
        if (!v) return 'End date is required';
        if (values.startDate && values.startDate > v) return 'End date must be on or after start date';
        return null;
      },
    },
    transformValues: (v) => ({ name: v.name.trim(), startDate: v.startDate, endDate: v.endDate }),
  });

  const submit = form.onSubmit(async (values) => {
    await onCreate({ ...values, academicYearId });
    form.reset();
    close();
  });

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add holiday
        </Button>
      </Group>

      <Paper withBorder p="md">
        {holidays.length === 0 ? (
          <Alert title="No holidays yet">
            <Text size="sm">Create holidays for the selected academic year.</Text>
          </Alert>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Start</Table.Th>
                <Table.Th>End</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {holidays.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>{h.name}</Table.Td>
                  <Table.Td>{h.startDate}</Table.Td>
                  <Table.Td>{h.endDate}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={close} title="Add holiday" size="md">
        <form onSubmit={submit}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="National Day" {...form.getInputProps('name')} />
            <Group grow>
              <TextInput label="Start date" type="date" {...form.getInputProps('startDate')} />
              <TextInput label="End date" type="date" {...form.getInputProps('endDate')} />
            </Group>
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={close} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" loading={isCreating}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}


