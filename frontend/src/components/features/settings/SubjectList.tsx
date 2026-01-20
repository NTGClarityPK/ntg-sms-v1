'use client';

import { Alert, Button, Group, Loader, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useCreateSubject, useSubjects } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';

export function SubjectList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const listQuery = useSubjects();
  const createMutation = useCreateSubject();

  const form = useForm<{ name: string; code: string }>({
    initialValues: { name: '', code: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), code: v.code.trim() }),
  });

  const onCreate = form.onSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({ name: values.name, code: values.code || undefined });
      notifications.show({ title: 'Success', message: 'Subject created', color: notifyColors.success });
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
      <Alert color={colors.error} title="Failed to load subjects">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  const subjects = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add subject
        </Button>
      </Group>

      <Paper withBorder p="md">
        {subjects.length === 0 ? (
          <Text c="dimmed" size="sm">
            No subjects yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Code</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {subjects.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td>{s.code ?? '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={close} title="Add subject" size="md">
        <form onSubmit={onCreate}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="Mathematics" {...form.getInputProps('name')} />
            <TextInput label="Code" placeholder="MATH" {...form.getInputProps('code')} />
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


