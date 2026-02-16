'use client';

import { Alert, ActionIcon, Button, Group, Skeleton, Modal, MultiSelect, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil } from '@tabler/icons-react';
import { useClasses, useCreateLevel, useLevels, useUpdateLevel } from '@/hooks/useCoreLookups';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { Level } from '@/types/settings';

export function LevelManager() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [editLevel, setEditLevel] = useState<Level | null>(null);
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const createMutation = useCreateLevel();
  const updateMutation = useUpdateLevel();

  const form = useForm<{ name: string; classIds: string[] }>({
    initialValues: { name: '', classIds: [] },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), classIds: v.classIds }),
  });

  const openCreate = () => {
    setEditLevel(null);
    form.setValues({ name: '', classIds: [] });
    open();
  };

  const openEdit = (l: Level) => {
    setEditLevel(l);
    form.setValues({ name: l.name, classIds: l.classes.map((c) => c.id) });
    open();
  };

  const handleClose = () => {
    close();
    setEditLevel(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      if (editLevel) {
        await updateMutation.mutateAsync({
          id: editLevel.id,
          payload: { name: values.name },
        });
        notifications.show({ title: 'Success', message: 'Level updated', color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: 'Success', message: 'Level created', color: notifyColors.success });
      }
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  });

  if (levelsQuery.isLoading || classesQuery.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={50} />
      </Stack>
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

  // Build a map of which classes are already assigned to levels (for create: disable assigned; for edit: allow current level's classes)
  const assignedClassIds = new Set<string>();
  const classToLevelMap = new Map<string, string>();
  levels.forEach((level) => {
    level.classes.forEach((cls) => {
      assignedClassIds.add(cls.id);
      classToLevelMap.set(cls.id, level.name);
    });
  });

  const editingLevelId = editLevel?.id;
  const editingLevelClassIds = editLevel ? new Set(editLevel.classes.map((c) => c.id)) : new Set<string>();

  // Create options: when editing, only disable classes assigned to *other* levels; when creating, disable all assigned
  const classOptions = classes.map((c) => {
    const isAssigned = assignedClassIds.has(c.id);
    const levelName = classToLevelMap.get(c.id);
    const isInEditingLevel = editingLevelId && editingLevelClassIds.has(c.id);
    const disabled = isAssigned && !isInEditingLevel;
    return {
      value: c.id,
      label: isAssigned && !isInEditingLevel ? `${c.displayName} (in ${levelName})` : c.displayName,
      disabled,
    };
  });

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="lg" fw={500}>Levels</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add level
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Levels help organise classes into groups such as Primary, Secondary, or Foundation. 
        Each level can contain multiple classes, making it easier to manage academic structures 
        and assign subject templates across related classes.
      </Text>

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
                <Table.Th width={80}>Actions</Table.Th>
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
                  <Table.Td>
                    <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(l)} aria-label="Edit level">
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={opened} onClose={handleClose} title={editLevel ? 'Edit level' : 'Add level'} size="md">
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="Primary" {...form.getInputProps('name')} />
            {!editLevel && (
              <MultiSelect
                label="Classes"
                placeholder="Select classes"
                data={classOptions}
                searchable
                {...form.getInputProps('classIds')}
              />
            )}
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}


