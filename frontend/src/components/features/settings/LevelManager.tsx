'use client';

import { Alert, Button, Group, Loader, Modal, MultiSelect, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useClasses, useCreateLevel, useLevels } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';

export function LevelManager() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const createMutation = useCreateLevel();

  const form = useForm<{ name: string; classIds: string[] }>({
    initialValues: { name: '', classIds: [] },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), classIds: v.classIds }),
  });

  const onCreate = form.onSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values);
      notifications.show({ title: 'Success', message: 'Level created', color: notifyColors.success });
      form.reset();
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  });

  if (levelsQuery.isLoading || classesQuery.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader color={colors.primary} />
      </Group>
    );
  }

  if (levelsQuery.error || classesQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load levels">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void levelsQuery.refetch();
              void classesQuery.refetch();
            }}
          >
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  const levels = levelsQuery.data?.data ?? [];
  const classes = classesQuery.data?.data ?? [];

  const classOptions = classes.map((c) => ({ value: c.id, label: c.displayName }));

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add level
        </Button>
      </Group>

      <Paper withBorder p="md">
        {levels.length === 0 ? (
          <Text c="dimmed" size="sm">
            No levels yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Classes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {levels.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.name}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {l.classes.length === 0 ? '-' : l.classes.map((c) => c.displayName).join(', ')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={close} title="Add level" size="md">
        <form onSubmit={onCreate}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="Primary" {...form.getInputProps('name')} />
            <MultiSelect
              label="Classes"
              placeholder="Select classes"
              data={classOptions}
              searchable
              {...form.getInputProps('classIds')}
            />
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


