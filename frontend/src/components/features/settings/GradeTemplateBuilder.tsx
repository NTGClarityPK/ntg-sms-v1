'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Skeleton,
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
import { GradeTemplateAssignment } from './GradeTemplateAssignment';
import { useTranslations } from 'next-intl';

interface RangeInput {
  letter: string;
  minPercentage: number;
  maxPercentage: number;
  sortOrder: number;
}

export function GradeTemplateBuilder() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
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
      name: (v) => (v.trim().length === 0 ? tSettings('gradeTemplateFormNameRequired') : null),
      ranges: (ranges) => (ranges.length === 0 ? tSettings('gradeTemplateFormRangesRequired') : null),
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
        await updateMutation.mutateAsync({ id: editingTemplate.id, name: values.name, ranges: values.ranges });
        notifications.show({ title: tCommon('success'), message: tSettings('gradeTemplateUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: tCommon('success'), message: tSettings('gradeTemplateCreated'), color: notifyColors.success });
      }
      form.reset();
      setEditingTemplate(null);
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  });

  const handleDelete = async (template: GradeTemplate) => {
    const confirmed = window.confirm(tSettings('gradeTemplateDeleteConfirm', { name: template.name }));
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(template.id);
      notifications.show({ title: tCommon('success'), message: tSettings('gradeTemplateDeleted'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

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
      <Alert color={colors.error} title={tSettings('gradeTemplateLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="grade-template-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const templates = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="lg" fw={500}>{tSettings('gradeTemplateTitle')}</Text>
        <Button id="grade-template-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('gradeTemplateAddButton')}
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {tSettings('gradeTemplateDescription')}
      </Text>

      <Paper withBorder p="md">
        {templates.length === 0 ? (
          <Text c="dimmed" size="sm">{tSettings('gradeTemplateNoData')}</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th>{tSettings('gradeTemplateColRanges')}</Table.Th>
                <Table.Th w={80}>{tCommon('actions')}</Table.Th>
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
                        : t.ranges.map((r) => `${r.letter} (${r.minPercentage}-${r.maxPercentage})`).join(', ')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Menu withinPortal position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle"><IconDotsVertical size={16} /></ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(t)}>
                          {tCommon('edit')}
                        </Menu.Item>
                        <Menu.Item leftSection={<IconTrash size={14} />} color={colors.error} onClick={() => handleDelete(t)}>
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

      <Stack gap="md" mt="xl">
        <Text size="lg" fw={500}>{tSettings('gradingConfigTitle')}</Text>
        <Text size="sm" c="dimmed" mb="md">{tSettings('gradingConfigDescription')}</Text>
        <GradeTemplateAssignment />
      </Stack>

      <Modal opened={opened} onClose={close} title={editingTemplate ? tSettings('gradeTemplateModalEdit') : tSettings('gradeTemplateModalCreate')} size="lg">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              id="grade-template-form-name"
              label={tSettings('gradeTemplateFormNameLabel')}
              placeholder={tSettings('gradeTemplateFormNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            <Paper withBorder p="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>{tSettings('gradeTemplateFormRangesTitle')}</Text>
                  <Button id="grade-template-form-add-range" variant="light" leftSection={<IconPlus size={16} />} onClick={addRange}>
                    {tSettings('gradeTemplateFormAddRange')}
                  </Button>
                </Group>
                {form.values.ranges.map((_, idx) => (
                  <Group key={idx} align="flex-end" grow>
                    <TextInput id={`grade-template-range-${idx}-letter`} label={tSettings('gradeTemplateFormRangeLetter')} {...form.getInputProps(`ranges.${idx}.letter`)} />
                    <NumberInput id={`grade-template-range-${idx}-min`} label={tSettings('gradeTemplateFormRangeMin')} min={0} max={100} {...form.getInputProps(`ranges.${idx}.minPercentage`)} />
                    <NumberInput id={`grade-template-range-${idx}-max`} label={tSettings('gradeTemplateFormRangeMax')} min={0} max={100} {...form.getInputProps(`ranges.${idx}.maxPercentage`)} />
                    <NumberInput id={`grade-template-range-${idx}-sort`} label={tSettings('gradeTemplateFormRangeSort')} min={0} {...form.getInputProps(`ranges.${idx}.sortOrder`)} />
                    <Button
                      id={`grade-template-range-${idx}-remove`}
                      variant="light"
                      onClick={() => removeRange(idx)}
                      disabled={form.values.ranges.length <= 1}
                      leftSection={<IconTrash size={16} />}
                    >
                      {tSettings('gradeTemplateFormRangeRemove')}
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Paper>
            <Group justify="flex-end" mt="md">
              <Button id="grade-template-form-cancel" variant="light" onClick={close} disabled={createMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="grade-template-form-submit" type="submit" loading={createMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
