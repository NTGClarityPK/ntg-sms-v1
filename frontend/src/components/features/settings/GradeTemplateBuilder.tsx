'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDotsVertical, IconPencil, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useCreateGradeTemplate, useDeleteGradeTemplate, useGradeTemplates, useUpdateGradeTemplate } from '@/hooks/useAssessmentSettings';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import type { GradeTemplate } from '@/types/settings';
import { useState } from 'react';

interface RangeInput {
  letter: string;
  minPercentage: number;
  maxPercentage: number;
  sortOrder: number;
}

export function GradeTemplateBuilder() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState<GradeTemplate | null>(null);
  const listQuery = useGradeTemplates();
  const createMutation = useCreateGradeTemplate();
  const updateMutation = useUpdateGradeTemplate();
  const deleteMutation = useDeleteGradeTemplate();

  const form = useForm<{ name: string; ranges: RangeInput[] }>({
    initialValues: {
      name: '',
      ranges: [{ letter: 'A', minPercentage: 90, maxPercentage: 100, sortOrder: 0 }],
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      ranges: (ranges) => (ranges.length === 0 ? 'At least one range is required' : null),
    },
    transformValues: (v) => ({
      name: v.name.trim(),
      ranges: v.ranges.map((r, idx) => ({
        ...r,
        letter: r.letter.trim(),
        sortOrder: r.sortOrder ?? idx,
      })),
    }),
  });

  const addRange = () => {
    const current = form.values.ranges;
    form.setFieldValue('ranges', [
      ...current,
      { letter: '', minPercentage: 0, maxPercentage: 0, sortOrder: current.length },
    ]);
  };

  const removeRange = (index: number) => {
    form.setFieldValue(
      'ranges',
      form.values.ranges.filter((_, i) => i !== index),
    );
  };

  const openCreate = () => {
    setEditingTemplate(null);
    form.setValues({
      name: '',
      ranges: [{ letter: 'A', minPercentage: 90, maxPercentage: 100, sortOrder: 0 }],
    });
    open();
  };

  const openEdit = (template: GradeTemplate) => {
    setEditingTemplate(template);
    form.setValues({
      name: template.name,
      ranges: template.ranges
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({
          letter: r.letter,
          minPercentage: r.minPercentage,
          maxPercentage: r.maxPercentage,
          sortOrder: r.sortOrder,
        })),
    });
    open();
  };

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          id: editingTemplate.id,
          name: values.name,
          ranges: values.ranges,
        });
        notifications.show({ title: 'Success', message: 'Grade template updated', color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: 'Success', message: 'Grade template created', color: notifyColors.success });
      }
      form.reset();
      setEditingTemplate(null);
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  });

  const handleDelete = async (template: GradeTemplate) => {
    const confirmed = window.confirm(`Delete grade template "${template.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(template.id);
      notifications.show({ title: 'Success', message: 'Grade template deleted', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (listQuery.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader color={colors.primary} />
      </Group>
    );
  }

  if (listQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load grade templates">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  const templates = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Add template
        </Button>
      </Group>

      <Paper withBorder p="md">
        {templates.length === 0 ? (
          <Text c="dimmed" size="sm">
            No grade templates yet.
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Ranges</Table.Th>
                <Table.Th w={80}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {t.ranges.length === 0
                        ? '-'
                        : t.ranges
                            .map((r) => `${r.letter} (${r.minPercentage}-${r.maxPercentage})`)
                            .join(', ')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Menu withinPortal position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconPencil size={14} />}
                          onClick={() => openEdit(t)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color={colors.error}
                          onClick={() => handleDelete(t)}
                        >
                          Delete
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

      <Modal opened={opened} onClose={close} title={editingTemplate ? 'Edit grade template' : 'Create grade template'} size="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput label="Template name" placeholder="Primary grading" {...form.getInputProps('name')} />

            <Paper withBorder p="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>Ranges</Text>
                  <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addRange}>
                    Add range
                  </Button>
                </Group>

                {form.values.ranges.map((_, idx) => (
                  <Group key={idx} align="flex-end" grow>
                    <TextInput label="Letter" {...form.getInputProps(`ranges.${idx}.letter`)} />
                    <NumberInput label="Min %" min={0} max={100} {...form.getInputProps(`ranges.${idx}.minPercentage`)} />
                    <NumberInput label="Max %" min={0} max={100} {...form.getInputProps(`ranges.${idx}.maxPercentage`)} />
                    <NumberInput label="Sort" min={0} {...form.getInputProps(`ranges.${idx}.sortOrder`)} />
                    <Button
                      variant="light"
                      onClick={() => removeRange(idx)}
                      disabled={form.values.ranges.length <= 1}
                      leftSection={<IconTrash size={16} />}
                    >
                      Remove
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Paper>

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


