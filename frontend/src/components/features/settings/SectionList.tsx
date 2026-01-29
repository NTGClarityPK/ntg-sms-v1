'use client';

import { Alert, Button, Group, Skeleton, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useCreateSection, useSections } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';

export function SectionList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const listQuery = useSections();
  const createMutation = useCreateSection();

  const form = useForm<{ name: string }>({
    initialValues: { name: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
    },
    transformValues: (v) => ({ name: v.name.trim() }),
  });

  const onCreate = form.onSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values);
      notifications.show({ title: 'Success', message: 'Section created', color: notifyColors.success });
      form.reset();
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
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
      <Alert color={colors.error} title="Failed to load sections">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  const sections = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add section
        </Button>
      </Group>

      <Paper withBorder p="md">
        {sections.length === 0 ? (
          <Text c="dimmed" size="sm">
            No sections yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sections.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.name}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={close} title="Add section" size="md">
        <form onSubmit={onCreate}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="A" {...form.getInputProps('name')} />
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


