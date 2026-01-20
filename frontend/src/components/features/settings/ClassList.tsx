'use client';

import { Alert, Button, Group, Loader, Modal, NumberInput, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useClasses, useCreateClass } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';

export function ClassList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const listQuery = useClasses();
  const createMutation = useCreateClass();

  const form = useForm<{ name: string; displayName: string; sortOrder: number }>({
    initialValues: { name: '', displayName: '', sortOrder: 0 },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      displayName: (v) => (v.trim().length === 0 ? 'Display name is required' : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), displayName: v.displayName.trim(), sortOrder: v.sortOrder }),
  });

  const onCreate = form.onSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values);
      notifications.show({ title: 'Success', message: 'Class created', color: notifyColors.success });
      form.reset();
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  });

  if (listQuery.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader color={colors.primary} />
      </Group>
    );
  }

  if (listQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load classes">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  const classes = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add class
        </Button>
      </Group>

      <Paper withBorder p="md">
        {classes.length === 0 ? (
          <Text c="dimmed" size="sm">
            No classes yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Display name</Table.Th>
                <Table.Th>Sort</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {classes.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>{c.displayName}</Table.Td>
                  <Table.Td>{c.sortOrder}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={close} title="Add class" size="md">
        <form onSubmit={onCreate}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="10" {...form.getInputProps('name')} />
            <TextInput label="Display name" placeholder="Grade 10" {...form.getInputProps('displayName')} />
            <NumberInput label="Sort order" min={0} {...form.getInputProps('sortOrder')} />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={close} disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}


